'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

const supabase = createClient()

const STAGE_CONFIG: Record<string, { color: string; bg: string; label: string }> = {
  inward:  { color: '#3b82f6', bg: 'rgba(59,130,246,0.1)',  label: 'Inward'   },
  storage: { color: '#f59e0b', bg: 'rgba(245,158,11,0.1)',  label: 'Storage'  },
  outward: { color: '#ef4444', bg: 'rgba(239,68,68,0.1)',   label: 'Outward'  },
}

const STATUS_CONFIG: Record<string, { color: string; bg: string }> = {
  open:          { color: '#f59e0b', bg: 'rgba(245,158,11,0.1)'  },
  investigating: { color: '#3b82f6', bg: 'rgba(59,130,246,0.1)'  },
  resolved:      { color: '#22c55e', bg: 'rgba(34,197,94,0.1)'   },
}

export default function DiscrepanciesPage() {
  const router = useRouter()
  const [discrepancies, setDiscrepancies] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [updating, setUpdating] = useState<string | null>(null)

  useEffect(() => { loadData() }, [])

  async function loadData() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }

    const { data } = await supabase
      .from('discrepancies')
      .select(`*, 
        reporter:reported_by(name, shift),
        location:locations(name),
        set:sets(qr_code, product:products(name))
      `)
      .order('created_at', { ascending: false })

    setDiscrepancies(data || [])
    setLoading(false)
  }

  async function updateStatus(id: string, status: string) {
    setUpdating(id)
    await supabase.from('discrepancies').update({ status }).eq('id', id)
    await loadData()
    setUpdating(null)
  }

  const filtered = discrepancies.filter(d =>
    filter === 'all' || d.status === filter
  )

  const stats = {
    total:         discrepancies.length,
    open:          discrepancies.filter(d => d.status === 'open').length,
    investigating: discrepancies.filter(d => d.status === 'investigating').length,
    resolved:      discrepancies.filter(d => d.status === 'resolved').length,
    totalLoss:     discrepancies.reduce((a, d) => a + Math.abs(d.delta || 0), 0),
  }

  if (loading) return (
    <div style={{ minHeight: '100vh', background: '#060608', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: 32, height: 32, border: '2px solid rgba(239,68,68,0.2)', borderTopColor: '#ef4444', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: '#060608', color: '#fff', fontFamily: "'DM Sans',system-ui,sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;600&display=swap');
        *{box-sizing:border-box;margin:0;padding:0}
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes fadeUp{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
      `}</style>

      <nav style={{ position: 'sticky', top: 0, zIndex: 100, background: 'rgba(6,6,8,0.9)', backdropFilter: 'blur(20px)', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 28px', height: 56 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={() => router.push('/dashboard')} style={{ background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.3)', fontSize: 18, cursor: 'pointer' }}>←</button>
          <span style={{ fontWeight: 800, fontSize: 15, color: '#f97316' }}>BrokenSet</span>
          <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.2)', fontFamily: "'JetBrains Mono',monospace" }}>/ DISCREPANCIES</span>
        </div>
        <div style={{ padding: '4px 10px', borderRadius: 8, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.15)' }}>
          <span style={{ fontSize: 11, color: '#ef4444', fontWeight: 600, fontFamily: "'JetBrains Mono',monospace" }}>{stats.open} OPEN ALERTS</span>
        </div>
      </nav>

      <div style={{ padding: '28px', maxWidth: 1100, margin: '0 auto' }}>
        <div style={{ marginBottom: 24, animation: 'fadeUp 0.4s ease' }}>
          <h1 style={{ fontSize: 28, fontWeight: 900, letterSpacing: '-1px' }}>
            All <span style={{ color: '#ef4444' }}>Discrepancies</span>
          </h1>
          <p style={{ color: 'rgba(255,255,255,0.28)', fontSize: 13, marginTop: 4 }}>
            Every mismatch across all checkpoints · Total {stats.totalLoss} pieces lost
          </p>
        </div>

        {/* STATS */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 24 }}>
          {[
            { label: 'Total',         value: stats.total,         color: '#fff'     },
            { label: 'Open',          value: stats.open,          color: '#f59e0b'  },
            { label: 'Investigating', value: stats.investigating,  color: '#3b82f6'  },
            { label: 'Resolved',      value: stats.resolved,      color: '#22c55e'  },
          ].map(({ label, value, color }) => (
            <div key={label} style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 12, padding: '16px' }}>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', marginBottom: 8 }}>{label}</div>
              <div style={{ fontSize: 32, fontWeight: 900, color, letterSpacing: '-1px' }}>{value}</div>
            </div>
          ))}
        </div>

        {/* FILTERS */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
          {['all', 'open', 'investigating', 'resolved'].map(f => (
            <button key={f} onClick={() => setFilter(f)} style={{
              padding: '8px 16px', borderRadius: 8, fontSize: 12, fontWeight: 600,
              cursor: 'pointer', textTransform: 'capitalize',
              background: filter === f ? 'rgba(239,68,68,0.15)' : 'rgba(255,255,255,0.03)',
              border: filter === f ? '1px solid rgba(239,68,68,0.3)' : '1px solid rgba(255,255,255,0.06)',
              color: filter === f ? '#ef4444' : 'rgba(255,255,255,0.4)',
            }}>{f} {filter === f && `(${filtered.length})`}</button>
          ))}
        </div>

        {/* LIST */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {filtered.map((d: any, i: number) => {
            const stage  = STAGE_CONFIG[d.stage]  || STAGE_CONFIG.inward
            const status = STATUS_CONFIG[d.status] || STATUS_CONFIG.open
            return (
              <div key={d.id} style={{
                background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)',
                borderRadius: 14, padding: '18px 22px',
                display: 'grid', gridTemplateColumns: '1fr auto',
                animation: `fadeUp 0.3s ease ${i * 0.03}s both`,
              }}>
                <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
                  {/* Icon */}
                  <div style={{ width: 42, height: 42, borderRadius: 10, flexShrink: 0,
                    background: stage.bg, border: `1px solid ${stage.color}30`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>
                    {d.stage === 'inward' ? '📦' : d.stage === 'storage' ? '🏭' : '🚫'}
                  </div>

                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 14, fontWeight: 700 }}>
                        {d.reporter?.name || 'Unknown'} flagged by {d.set?.product?.name || 'Unknown product'}
                      </span>
                      <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 4, fontWeight: 700, fontFamily: "'JetBrains Mono',monospace", background: stage.bg, color: stage.color }}>
                        {stage.label.toUpperCase()}
                      </span>
                      <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 4, fontWeight: 700, fontFamily: "'JetBrains Mono',monospace", background: status.bg, color: status.color }}>
                        {d.status.toUpperCase()}
                      </span>
                    </div>
                    <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)' }}>
                      {d.location?.name} · Expected {d.expected_pieces} pieces · Got {d.actual_pieces} pieces ·{' '}
                      {new Date(d.created_at).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </div>
                    {d.set?.qr_code && (
                      <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.2)', fontFamily: "'JetBrains Mono',monospace", marginTop: 4 }}>
                        {d.set.qr_code}
                      </div>
                    )}
                  </div>
                </div>

                {/* Right side */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 10 }}>
                  <div style={{ fontSize: 28, fontWeight: 900, color: '#ef4444', letterSpacing: '-1px' }}>
                    {d.delta}
                  </div>
                  {d.status === 'open' && (
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button onClick={() => updateStatus(d.id, 'investigating')} disabled={updating === d.id}
                        style={{ padding: '5px 10px', borderRadius: 6, background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.2)', color: '#3b82f6', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
                        Investigate
                      </button>
                      <button onClick={() => updateStatus(d.id, 'resolved')} disabled={updating === d.id}
                        style={{ padding: '5px 10px', borderRadius: 6, background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.2)', color: '#22c55e', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
                        Resolve
                      </button>
                    </div>
                  )}
                  {d.status === 'investigating' && (
                    <button onClick={() => updateStatus(d.id, 'resolved')} disabled={updating === d.id}
                      style={{ padding: '5px 12px', borderRadius: 6, background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.2)', color: '#22c55e', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
                      Mark Resolved
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}