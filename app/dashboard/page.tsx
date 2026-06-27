'use client'
import { useState, useEffect, useCallback } from 'react'
import { useSession, signOut } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { Search, Download, Trash2, LogOut, Users, CheckCircle, Phone, Globe, ChevronDown, X, Star, RefreshCw, Settings } from 'lucide-react'

interface Lead {
  id?: number; name: string; phone: string; email?: string; address: string
  website?: string; category: string; rating: number; reviews: number
  status: string; keyword?: string; location?: string
}

const CATEGORIES = ['All Categories','Beauty & Hair','Food & Dining','Healthcare','Hospitality','Fitness & Wellness','Real Estate','Marketing & Advertising','Education','Dental Care']
const STATUS_OPTS = ['all','new','contacted','qualified','converted','lost']
const STATUS_COLORS: Record<string, string> = {
  new: 'bg-[#A3E635]/10 text-[#A3E635] border-[#A3E635]/20',
  contacted: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  qualified: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
  converted: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  lost: 'bg-red-500/10 text-red-400 border-red-500/20',
}

export default function DashboardPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [leads, setLeads] = useState<Lead[]>([])
  const [filtered, setFiltered] = useState<Lead[]>([])
  const [scraping, setScraping] = useState(false)
  const [progress, setProgress] = useState(0)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [catFilter, setCatFilter] = useState('All Categories')
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [form, setForm] = useState({ keyword: '', location: '', maxResults: '20' })
  const [delConfirm, setDelConfirm] = useState(false)
  const [view, setView] = useState<'scraper'|'leads'>('scraper')
  const [page, setPage] = useState(1)
  const PER_PAGE = 25

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login')
    if (status === 'authenticated' && (session?.user as { role?: string })?.role === 'admin') router.push('/admin')
  }, [status, session, router])

  useEffect(() => {
    let list = [...leads]
    if (statusFilter !== 'all') list = list.filter(l => l.status === statusFilter)
    if (catFilter !== 'All Categories') list = list.filter(l => l.category === catFilter)
    if (search) list = list.filter(l => l.name.toLowerCase().includes(search.toLowerCase()) || (l.phone||'').includes(search))
    setFiltered(list)
    setPage(1)
  }, [leads, statusFilter, catFilter, search])

  useEffect(() => {
    if (status !== 'authenticated') return
    fetch('/api/leads').then(r => r.json()).then(d => { if (d.leads) setLeads(d.leads) })
  }, [status])

  const startScrape = useCallback(async () => {
    if (!form.keyword || !form.location) return
    setScraping(true); setProgress(0)
    const tick = setInterval(() => setProgress(p => Math.min(p + 4, 90)), 200)
    try {
      const res = await fetch('/api/scrape', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keyword: form.keyword, location: form.location, maxResults: Number(form.maxResults) }),
      })
      const data = await res.json()
      clearInterval(tick); setProgress(100)
      setLeads(prev => [...data.leads, ...prev])
      await fetch('/api/leads', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data.leads) })
    } finally {
      clearInterval(tick)
      setTimeout(() => { setScraping(false); setProgress(0) }, 600)
    }
  }, [form])

  const exportCSV = useCallback(() => {
    const rows = [['Name','Phone','Email','Address','Website','Category','Rating','Reviews','Status']]
    filtered.forEach(l => rows.push([l.name,l.phone,l.email||'',l.address,l.website||'',l.category,String(l.rating),String(l.reviews),l.status]))
    const csv = rows.map(r => r.map(c => `"${c}"`).join(',')).join('\n')
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
    const a = document.createElement('a'); a.href = url; a.download = 'leadfrog_leads.csv'; a.click()
  }, [filtered])

  const deleteAll = useCallback(async () => {
    await fetch('/api/leads', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ids: 'all' }) })
    setLeads([]); setDelConfirm(false)
  }, [])

  const cycleStatus = useCallback((idx: number) => {
    const order = ['new','contacted','qualified','converted','lost']
    setLeads(prev => prev.map((l, i) => i === idx ? { ...l, status: order[(order.indexOf(l.status) + 1) % order.length] } : l))
  }, [])

  const toggleSelect = (i: number) => setSelected(s => { const n = new Set(s); n.has(i) ? n.delete(i) : n.add(i); return n })
  const selectAll = () => setSelected(filtered.length === selected.size ? new Set() : new Set(filtered.map((_, i) => i)))

  const paged = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE)
  const totalPages = Math.ceil(filtered.length / PER_PAGE)

  const stats = {
    total: leads.length,
    qualified: leads.filter(l => l.status === 'qualified').length,
    contacted: leads.filter(l => l.status === 'contacted').length,
    hasWebsite: leads.filter(l => l.website).length,
  }

  if (status === 'loading') return <div className="min-h-screen bg-[#050A06] flex items-center justify-center text-[#4B6856]">Loading...</div>

  return (
    <div className="flex h-screen bg-[#050A06] overflow-hidden">
      {/* Sidebar */}
      <aside className="w-52 shrink-0 flex flex-col border-r border-[#122016] bg-[#070D08]">
        <div className="p-4 border-b border-[#122016] flex flex-col items-center gap-2">
          <Image src="/logo.png" alt="LeadFrog" width={110} height={44} className="object-contain" />
          <span className="text-[8px] text-[#4B6856] tracking-widest uppercase">Lead Intelligence</span>
        </div>
        <nav className="flex-1 p-3 space-y-1 text-sm">
          <div className="text-[10px] text-[#4B6856] uppercase tracking-wider px-3 py-2">Workspace</div>
          <button onClick={() => setView('scraper')} className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left cursor-pointer transition-colors ${view === 'scraper' ? 'bg-[#0A1F0C] text-[#A3E635]' : 'text-[#94A3B8] hover:text-white hover:bg-[#0A110B]'}`}>
            <Search size={14} /> Scraper
          </button>
          <button onClick={() => setView('leads')} className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left cursor-pointer transition-colors ${view === 'leads' ? 'bg-[#0A1F0C] text-[#A3E635]' : 'text-[#94A3B8] hover:text-white hover:bg-[#0A110B]'}`}>
            <Users size={14} /> All Leads
            <span className="ml-auto text-xs bg-[#122016] px-2 py-0.5 rounded-full">{leads.length}</span>
          </button>
        </nav>
        <div className="p-3 space-y-1 text-sm border-t border-[#122016]">
          <div className="text-[10px] text-[#4B6856] uppercase tracking-wider px-3 py-2">Export</div>
          <button onClick={exportCSV} className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-[#94A3B8] hover:text-white hover:bg-[#0A110B] text-left cursor-pointer">
            <Download size={14} /> Export CSV
          </button>
          {(session?.user as { role?: string })?.role === 'admin' && (
            <button onClick={() => router.push('/admin')} className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-[#94A3B8] hover:text-[#A3E635] hover:bg-[#0A110B] text-left cursor-pointer">
              <Settings size={14} /> Admin
            </button>
          )}
          <button onClick={() => signOut({ callbackUrl: '/login' })} className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-[#94A3B8] hover:text-red-400 hover:bg-[#0A110B] text-left cursor-pointer">
            <LogOut size={14} /> Sign Out
          </button>
        </div>
        <div className="p-3 text-[10px] text-[#4B6856] text-center border-t border-[#122016]">LeadFrog © 2025</div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Topbar */}
        <header className="flex items-center justify-between px-6 py-3 border-b border-[#122016] shrink-0">
          <span className="text-white font-semibold font-heading">{view === 'scraper' ? 'Scraper' : 'All Leads'}</span>
          <div className="flex gap-3">
            <button onClick={() => setDelConfirm(true)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-[#94A3B8] border border-[#122016] hover:border-red-500/30 hover:text-red-400 transition-all cursor-pointer">
              <Trash2 size={13} /> Clear All
            </button>
            <button onClick={exportCSV} className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs bg-amber-500/90 hover:bg-amber-400 text-black font-semibold transition-all cursor-pointer">
              <Download size={13} /> Export CSV
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-5 space-y-4 scrollbar-dark">
          {/* Stats */}
          <div className="grid grid-cols-4 gap-3">
            {[
              { label: 'Total Leads', value: stats.total, icon: Users },
              { label: 'Qualified', value: stats.qualified, icon: CheckCircle, pct: stats.total ? Math.round(stats.qualified/stats.total*100) : 0 },
              { label: 'Contacted', value: stats.contacted, icon: Phone, pct: stats.total ? Math.round(stats.contacted/stats.total*100) : 0 },
              { label: 'With Website', value: stats.hasWebsite, icon: Globe, pct: stats.total ? Math.round(stats.hasWebsite/stats.total*100) : 0 },
            ].map(({ label, value, icon: Icon, pct }) => (
              <div key={label} className="glass-card p-4">
                <div className="flex items-center justify-between mb-1">
                  <Icon size={16} className="text-[#4B6856]" />
                  {pct !== undefined && <span className="text-[10px] text-[#A3E635]">{pct}%</span>}
                </div>
                <div className="text-2xl font-bold text-white font-heading">{value}</div>
                <div className="text-xs text-[#4B6856]">{label}</div>
              </div>
            ))}
          </div>

          {/* Scrape Form */}
          {view === 'scraper' && (
          <div className="glass-card p-5">
            <div className="flex items-center gap-2 mb-4">
              <Search size={16} className="text-[#A3E635]" />
              <span className="text-white font-semibold text-sm">Scrape New Leads</span>
              <span className="text-xs text-[#4B6856] ml-1">Google Maps</span>
            </div>
            <div className="flex flex-wrap gap-3 items-end mb-3">
              <div className="flex-1 min-w-[160px]">
                <label className="text-[10px] text-[#4B6856] uppercase tracking-wider block mb-1">Keyword / Business Type</label>
                <input value={form.keyword} onChange={e => setForm(f => ({ ...f, keyword: e.target.value }))}
                  placeholder="e.g. Dentists, Salons, Gyms"
                  className="input-dark w-full px-3 py-2 rounded-xl text-sm" />
              </div>
              <div className="flex-1 min-w-[160px]">
                <label className="text-[10px] text-[#4B6856] uppercase tracking-wider block mb-1">City / Location</label>
                <input value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))}
                  placeholder="e.g. Mumbai, Chennai"
                  className="input-dark w-full px-3 py-2 rounded-xl text-sm" />
              </div>
              <div className="w-36">
                <label className="text-[10px] text-[#4B6856] uppercase tracking-wider block mb-1">Max Results</label>
                <select value={form.maxResults} onChange={e => setForm(f => ({ ...f, maxResults: e.target.value }))}
                  className="input-dark w-full px-3 py-2 rounded-xl text-sm cursor-pointer">
                  {['10','20','50'].map(n => <option key={n} value={n}>{n} results</option>)}
                </select>
              </div>
              <button onClick={startScrape} disabled={scraping || !form.keyword || !form.location}
                className="btn-lime px-6 py-2 rounded-xl text-sm flex items-center gap-2 disabled:opacity-40 whitespace-nowrap">
                {scraping ? <><RefreshCw size={14} className="animate-spin" /> Scraping...</> : <><Search size={14} /> Start Scraping</>}
              </button>
            </div>
            {scraping && (
              <div className="w-full h-1.5 bg-[#0A110B] rounded-full overflow-hidden mt-2">
                <div className="h-full bg-gradient-to-r from-[#166534] via-[#4ADE80] to-[#A3E635] rounded-full transition-all duration-300" style={{ width: `${progress}%` }} />
              </div>
            )}
          </div>
          )}

          {/* Filters */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="relative flex-1 min-w-[180px]">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#4B6856]" />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search leads..."
                className="input-dark w-full pl-8 pr-3 py-2 rounded-xl text-sm" />
            </div>
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="input-dark px-3 py-2 rounded-xl text-sm cursor-pointer">
              {STATUS_OPTS.map(s => <option key={s} value={s}>{s === 'all' ? 'All Status' : s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
            </select>
            <select value={catFilter} onChange={e => setCatFilter(e.target.value)} className="input-dark px-3 py-2 rounded-xl text-sm cursor-pointer">
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <span className="text-xs text-[#4B6856] ml-auto">{filtered.length} leads</span>
          </div>

          {/* Bulk bar */}
          {selected.size > 0 && (
            <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-[#A3E635]/5 border border-[#A3E635]/20 text-sm">
              <span className="text-[#A3E635]">{selected.size} selected</span>
              <button onClick={() => { setLeads(prev => prev.filter((_, i) => !selected.has(i))); setSelected(new Set()) }}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 cursor-pointer text-xs">
                <Trash2 size={12} /> Delete
              </button>
              <button onClick={() => setSelected(new Set())} className="ml-auto text-[#4B6856] hover:text-white cursor-pointer">
                <X size={14} />
              </button>
            </div>
          )}

          {/* Table */}
          <div className="glass-card overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#122016]">
                  <th className="p-3 text-left w-8">
                    <input type="checkbox" onChange={selectAll} checked={selected.size === filtered.length && filtered.length > 0} className="cursor-pointer accent-[#A3E635]" />
                  </th>
                  {['Business Name','Phone','Address','Rating','Website','Category','Status'].map(h => (
                    <th key={h} className="p-3 text-left text-[10px] text-[#4B6856] uppercase tracking-wider font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {paged.length === 0 ? (
                  <tr><td colSpan={8} className="text-center py-16 text-[#4B6856]">
                    <Search size={32} className="mx-auto mb-3 text-[#122016]" />
                    <div>No leads yet</div>
                    <div className="text-xs mt-1">Click Start Scraping to begin</div>
                  </td></tr>
                ) : paged.map((lead, i) => {
                  const realIdx = (page - 1) * PER_PAGE + i
                  return (
                    <tr key={realIdx} className={`border-b border-[#0A110B] hover:bg-[#0A110B]/50 transition-colors ${selected.has(realIdx) ? 'bg-[#A3E635]/5' : ''}`}>
                      <td className="p-3"><input type="checkbox" checked={selected.has(realIdx)} onChange={() => toggleSelect(realIdx)} className="cursor-pointer accent-[#A3E635]" /></td>
                      <td className="p-3 max-w-[220px]">
                        <div className="font-medium text-white truncate" title={lead.name}>{lead.name}</div>
                      </td>
                      <td className="p-3 text-[#94A3B8] whitespace-nowrap text-sm">{lead.phone || '—'}</td>
                      <td className="p-3 text-[#94A3B8] text-xs max-w-[180px]">
                        <div className="truncate" title={lead.address}>{lead.address}</div>
                      </td>
                      <td className="p-3 whitespace-nowrap">
                        <div className="flex items-center gap-1 text-[#94A3B8]">
                          <Star size={12} className="text-amber-400 fill-amber-400" />
                          {lead.rating} <span className="text-[#4B6856] text-xs">({lead.reviews})</span>
                        </div>
                      </td>
                      <td className="p-3 text-xs max-w-[130px]">
                        <div className="truncate text-[#A3E635]" title={lead.website || ''}>{lead.website || '—'}</div>
                      </td>
                      <td className="p-3 text-xs text-[#94A3B8] whitespace-nowrap">{lead.category}</td>
                      <td className="p-3">
                        <button onClick={() => cycleStatus(realIdx)} className={`px-2 py-1 rounded-full text-xs border cursor-pointer whitespace-nowrap ${STATUS_COLORS[lead.status] || STATUS_COLORS.new}`}>
                          {lead.status}
                          <ChevronDown size={10} className="inline ml-1" />
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 pb-4">
              {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                <button key={p} onClick={() => setPage(p)}
                  className={`w-8 h-8 rounded-lg text-sm cursor-pointer ${p === page ? 'bg-[#16A34A] text-white' : 'text-[#4B6856] hover:text-white border border-[#122016]'}`}>
                  {p}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Delete confirm */}
      {delConfirm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="glass-card p-7 max-w-sm w-full text-center">
            <div className="w-12 h-12 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto mb-4">
              <Trash2 size={22} className="text-red-400" />
            </div>
            <h3 className="text-white font-semibold mb-2 font-heading">Delete all leads?</h3>
            <p className="text-[#94A3B8] text-sm mb-6">This will permanently remove all {leads.length} leads. This cannot be undone.</p>
            <div className="flex gap-3">
              <button onClick={() => setDelConfirm(false)} className="flex-1 py-2.5 rounded-xl border border-[#122016] text-[#94A3B8] hover:text-white transition-all cursor-pointer text-sm">Cancel</button>
              <button onClick={deleteAll} className="flex-1 py-2.5 rounded-xl bg-red-500/90 hover:bg-red-500 text-white font-semibold transition-all cursor-pointer text-sm">Delete All</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
