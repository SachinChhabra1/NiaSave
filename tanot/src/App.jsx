import { useEffect, useMemo, useRef, useState } from 'react'
import { executives, initialCampaigns, initialCohorts, initialOpportunities, initialStudios, navItems, stageOrder } from './data'
import { Header, NewCampaignModal, OpportunityDrawer, Sidebar } from './components'
import { AccountsPage, ActivationsPage, CampaignsPage, InsightsPage, OverviewPage, PipelinePage, ResourcesPage, StudiosPage } from './pages'
import { generateManagementReport } from './insightEngine'

const pageTitles = {
  overview: 'Demand command centre',
  campaigns: 'Campaigns',
  accounts: 'Enterprise accounts',
  pipeline: 'Demand pipeline',
  resources: 'BD team',
  studios: 'Studio demand coverage',
  activations: 'Activations',
  insights: 'Insights & reports',
}

const localKeys = {
  campaigns: 'nia-demand-campaigns',
  opportunities: 'nia-demand-opportunities',
  cohorts: 'nia-demand-cohorts',
  actionState: 'nia-demand-action-state',
  reportHistory: 'nia-demand-report-history',
}

function readLocalWorkspace() {
  const fallback = {
    schemaVersion: 1,
    seeded: false,
    campaigns: initialCampaigns,
    opportunities: initialOpportunities,
    cohorts: initialCohorts,
    actionState: {},
    reportHistory: [],
    updatedAt: null,
  }
  try {
    const stored = Object.fromEntries(Object.entries(localKeys).map(([field, key]) => {
      const raw = localStorage.getItem(key)
      return [field, raw ? JSON.parse(raw) : fallback[field]]
    }))
    const seeded = Object.values(localKeys).some((key) => localStorage.getItem(key) !== null)
    return { ...fallback, ...stored, seeded }
  } catch {
    return fallback
  }
}

function writeLocalWorkspace(workspace) {
  try {
    Object.entries(localKeys).forEach(([field, key]) => {
      localStorage.setItem(key, JSON.stringify(workspace[field]))
    })
  } catch {
    // The server remains authoritative when browser storage is unavailable.
  }
}

function useDograWorkspace() {
  const [workspace, setWorkspace] = useState(readLocalWorkspace)
  const [syncState, setSyncState] = useState('loading')
  const versionRef = useRef(0)
  const readyRef = useRef(false)
  const skipNextSaveRef = useRef(false)
  const saveQueueRef = useRef(Promise.resolve())

  useEffect(() => {
    let cancelled = false
    async function hydrate() {
      try {
        const response = await fetch('/api/dogra/state', { headers: { Accept: 'application/json' } })
        if (!response.ok) throw new Error('load_failed')
        let payload = await response.json()
        const local = readLocalWorkspace()
        if (!payload.state.seeded && local.seeded) {
          const migration = await fetch('/api/dogra/state', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ state: local, expectedVersion: payload.version }),
          })
          if (migration.ok) payload = await migration.json()
        }
        if (cancelled) return
        versionRef.current = Number(payload.version || 0)
        skipNextSaveRef.current = true
        setWorkspace(payload.state)
        writeLocalWorkspace(payload.state)
        readyRef.current = true
        setSyncState('synced')
      } catch {
        if (!cancelled) {
          readyRef.current = true
          setSyncState('offline')
        }
      }
    }
    void hydrate()
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    writeLocalWorkspace(workspace)
    if (!readyRef.current) return
    if (skipNextSaveRef.current) {
      skipNextSaveRef.current = false
      return
    }
    setSyncState('saving')
    const timer = window.setTimeout(() => {
      const snapshot = workspace
      saveQueueRef.current = saveQueueRef.current.then(async () => {
        let expectedVersion = versionRef.current
        let response = await fetch('/api/dogra/state', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ state: snapshot, expectedVersion }),
        })
        if (response.status === 409) {
          const conflict = await response.json()
          expectedVersion = Number(conflict.current?.version || expectedVersion)
          response = await fetch('/api/dogra/state', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ state: snapshot, expectedVersion }),
          })
        }
        if (!response.ok) throw new Error('save_failed')
        const payload = await response.json()
        versionRef.current = Number(payload.version || expectedVersion)
        setSyncState('synced')
      }).catch(() => setSyncState('offline'))
    }, 450)
    return () => window.clearTimeout(timer)
  }, [workspace])

  function setter(field) {
    return (next) => setWorkspace((current) => ({
      ...current,
      [field]: typeof next === 'function' ? next(current[field]) : next,
    }))
  }

  return {
    workspace,
    syncState,
    setCampaigns: setter('campaigns'),
    setOpportunities: setter('opportunities'),
    setCohorts: setter('cohorts'),
    setActionState: setter('actionState'),
    setReportHistory: setter('reportHistory'),
  }
}

export default function App() {
  const [page, setPage] = useState('overview')
  const {
    workspace: { campaigns, opportunities, cohorts, actionState, reportHistory },
    syncState,
    setCampaigns,
    setOpportunities,
    setCohorts,
    setActionState,
    setReportHistory,
  } = useDograWorkspace()
  const [selectedId, setSelectedId] = useState('o1')
  const [drawerOpen, setDrawerOpen] = useState(() => !window.matchMedia('(max-width: 900px)').matches)
  const [campaignModal, setCampaignModal] = useState(false)
  const [query, setQuery] = useState('')
  const [toast, setToast] = useState('')
  const [reportVersion, setReportVersion] = useState(0)

  const selected = opportunities.find((item) => item.id === selectedId)

  const openOpportunity = (id) => {
    setSelectedId(id)
    setDrawerOpen(true)
  }

  const notify = (message) => {
    setToast(message)
    window.setTimeout(() => setToast(''), 2600)
  }

  const createCampaign = (form) => {
    setCampaigns((current) => [{
      id: `c${Date.now()}`,
      name: form.name,
      studio: form.studio,
      audience: form.audience,
      status: form.launchNow ? 'Live' : 'Draft',
      contacts: Number(form.contacts) || 0,
      engaged: 0,
      qualified: 0,
      contracted: 0,
      live: 0,
      owner: 'Arjun Rao',
      start: new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
    }, ...current])
    setCampaignModal(false)
    setPage('campaigns')
    notify(form.launchNow ? 'Campaign launched' : 'Campaign saved as draft')
  }

  const updateOpportunity = (id, patch) => {
    setOpportunities((current) => current.map((item) => item.id === id ? { ...item, ...patch } : item))
  }

  const completeAction = (id) => {
    updateOpportunity(id, { nextAction: 'Schedule next milestone', due: 'Not set' })
    notify('Action completed')
  }

  const advanceStage = (id) => {
    const opportunity = opportunities.find((item) => item.id === id)
    const index = stageOrder.indexOf(opportunity.stage)
    if (index === -1 || index === stageOrder.length - 1) return
    const nextStage = stageOrder[index + 1]
    updateOpportunity(id, {
      stage: nextStage,
      days: 0,
      events: [[`Moved to ${nextStage}`, 'Just now', `Stage advanced by ${opportunity.owner}.`], ...opportunity.events],
    })
    notify(`Moved to ${nextStage}`)
  }

  const recordActivation = (id, quantity) => {
    const opportunity = opportunities.find((item) => item.id === id)
    const nextLive = Math.min(opportunity.committed, opportunity.live + quantity)
    const nextStage = nextLive === opportunity.committed ? 'Live' : 'Mobilisation'
    updateOpportunity(id, {
      live: nextLive,
      stage: nextStage,
      events: [[`${quantity} members confirmed live`, 'Just now', `${nextLive} of ${opportunity.committed} committed members are now live.`], ...opportunity.events],
    })
    setCohorts((current) => current.map((cohort) => cohort.account === opportunity.account ? { ...cohort, live: nextLive, status: nextStage === 'Live' ? 'Live' : 'Mobilising' } : cohort))
    notify(`${quantity} live activations recorded`)
  }

  const filteredOpportunities = useMemo(() => {
    if (!query.trim()) return opportunities
    const needle = query.toLowerCase()
    return opportunities.filter((item) => [item.account, item.studio, item.campaign, item.stage, item.owner].some((value) => value.toLowerCase().includes(needle)))
  }, [opportunities, query])

  const report = useMemo(() => generateManagementReport({
    campaigns,
    opportunities,
    studios: initialStudios,
    executives,
    actionState,
    asOf: '2026-09-03',
  }), [campaigns, opportunities, actionState, reportVersion])

  const setGeneratedAction = (id, status) => {
    setActionState((current) => ({ ...current, [id]: status }))
    notify(status === 'Done' ? 'Action marked done' : 'Action reopened')
  }

  const saveReport = () => {
    const snapshot = {
      id: `${report.id}-${Date.now()}`,
      generatedAt: report.generatedAt,
      period: report.period,
      headline: report.headline,
      metrics: report.metrics,
      openActions: report.actions.filter((item) => item.status !== 'Done').length,
    }
    setReportHistory((current) => [snapshot, ...current].slice(0, 8))
    setReportVersion((current) => current + 1)
    notify('Management report snapshot saved')
  }

  const pageProps = { campaigns, opportunities: filteredOpportunities, cohorts, openOpportunity, query, notify, setPage, report, reportHistory, saveReport, setGeneratedAction }

  return (
    <div className="app-shell">
      <Sidebar items={navItems} active={page} onSelect={(next) => { setPage(next); setDrawerOpen(false) }} />
      <div className={`workspace ${drawerOpen && selected ? 'with-drawer' : ''}`}>
        <Header title={pageTitles[page]} query={query} onQuery={setQuery} onNew={() => setCampaignModal(true)} />
        <main className="page-canvas">
          {page === 'overview' && <OverviewPage {...pageProps} />}
          {page === 'campaigns' && <CampaignsPage {...pageProps} />}
          {page === 'accounts' && <AccountsPage {...pageProps} />}
          {page === 'pipeline' && <PipelinePage {...pageProps} />}
          {page === 'resources' && <ResourcesPage {...pageProps} />}
          {page === 'studios' && <StudiosPage {...pageProps} />}
          {page === 'activations' && <ActivationsPage {...pageProps} recordActivation={recordActivation} />}
          {page === 'insights' && <InsightsPage {...pageProps} />}
        </main>
      </div>

      {drawerOpen && selected && (
        <OpportunityDrawer
          opportunity={selected}
          onClose={() => setDrawerOpen(false)}
          onComplete={() => completeAction(selected.id)}
          onAdvance={() => advanceStage(selected.id)}
          onRecord={(quantity) => recordActivation(selected.id, quantity)}
        />
      )}
      {campaignModal && <NewCampaignModal onClose={() => setCampaignModal(false)} onCreate={createCampaign} />}
      {toast && <div className="toast" role="status">{toast}</div>}
      {!toast && syncState === 'offline' && <div className="toast" role="status">Shared Dogra data is offline. Changes remain safe in this browser and will retry after reload.</div>}
    </div>
  )
}
