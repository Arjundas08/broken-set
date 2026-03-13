'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import QRCode from 'qrcode'

const supabase = createClient()

function QRCanvas({ value }: { value: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    if (canvasRef.current) {
      QRCode.toCanvas(canvasRef.current, value, {
        width: 80,
        margin: 1,
        color: { dark: '#ffffff', light: '#00000000' },
      })
    }
  }, [value])
  return <canvas ref={canvasRef} style={{ borderRadius: 6 }} />
}

const STATUS_CONFIG: Record<string, { color: string; bg: string; border: string; label: string; icon: string }> = {
  complete:   { color: '#22c55e', bg: 'rgba(34,197,94,0.1)',   border: 'rgba(34,197,94,0.2)',   label: 'Complete',   icon: '✓' },
  opened:     { color: '#f59e0b', bg: 'rgba(245,158,11,0.1)',  border: 'rgba(245,158,11,0.2)',  label: 'Opened',     icon: '📂' },
  broken:     { color: '#ef4444', bg: 'rgba(239,68,68,0.1)',   border: 'rgba(239,68,68,0.2)',   label: 'Broken',     icon: '🚫' },
  dispatched: { color: '#3b82f6', bg: 'rgba(59,130,246,0.1)',  border: 'rgba(59,130,246,0.2)',  label: 'Dispatched', icon: '✈' },
}

export default function StoragePage() {
  const router = useRouter()
  const [staff, setStaff]       = useState<any>(null)
  const [sets, setSets]         = useState<any[]>([])
  const [batches, setBatches]   = useState<any[]>([])
  const [loading, setLoading]   = useState(true)
  const [filter, setFilter]     = useState('all')
  const [search, setSearch]     = useState('')
  const [auditModal, setAuditModal] = useState<any>(null)
  const [auditPieces, setAuditPieces] = useState('')
  const [auditLoading, setAuditLoading] = useState(false)
  const [auditSuccess, setAuditSuccess] = useState(false)
  const [selectedSet, setSelectedSet] = useState<any>(null)

  useEffect(() => { loadData() }, [])

  async function loadData() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }

    const { data: s } = await supabase
      .from('staff').select('*, location:locations(*)')
      .eq('id', user.id).single()
    setStaff(s)

    const [{ data: setsData }, { data: batchData }] = await Promise.all([
      supabase.from('sets')
        .select('*, product:products(name,pieces_per_set), batch:inward_batches(id,created_at,supplier:suppliers(name))')
        .eq('location_id', s?.location_id)
        .order('created_at', { ascending: false }),
      supabase.from('inward_batches')
        .select('*, product:products(name), supplier:suppliers(name)')
        .eq('location_id', s?.location_id)
        .order('created_at', { ascending: false })
        .limit(10),
    ])

    setSets(setsData || [])
    setBatches(batchData || [])
    setLoading(false)
  }

  async function triggerAudit(set: any) {
    setAuditModal(set)
    setAuditPieces('')
    setAuditSuccess(false)
  }

  async function confirmAudit() {
    if (!auditPieces || !staff) return
    setAuditLoading(true)

    const expected = auditModal.product?.pieces_per_set
    const actual   = Number(auditPieces)
    const isClean  = actual >= expected

    await supabase.from('access_logs').insert({
      set_id:           auditModal.id,
      staff_id:         staff.id,
      action:           'audited',
      pieces_confirmed: actual,
      expected_pieces:  expected,
      notes:            `Spot audit: ${actual}/${expected} pieces`,
    })

    if (!isClean) {
      await supabase.from('sets').update({
        status:          'broken',
        integrity_score: Math.round(actual / expected * 100),
      }).eq('id', auditModal.id)

      await supabase.from('discrepancies').insert({
        set_id:          auditModal.id,
        batch_id:        auditModal.batch_id,
        reported_by:     staff.id,
        location_id:     staff.location_id,
        stage:           'storage',
        expected_pieces: expected,
        actual_pieces:   actual,
        delta:           actual - expected,
        status:          'open',
      })
    } else {
      await supabase.from('sets').update({ status: 'complete', integrity_score: 100 }).eq('id', auditModal.id)
    }

    setAuditSuccess(true)
    setAuditLoading(false)
    await loadData()
  }

  const filtered = sets.filter(s => {
    const matchFilter = filter === 'all' || s.status === filter
    const matchSearch = !search || s.qr_code.toLowerCase().includes(search.toLowerCase()) ||
      s.product?.name.toLowerCase().includes(search.toLowerCase())
    return matchFilter && matchSearch
  })

  const stats = {
    total:      sets.length,
    complete:   sets.filter(s => s.status === 'complete').length,
    broken:     sets.filter(s => s.status === 'broken').length,
    dispatched: sets.filter(s => s.status === 'dispatched').length,
    avgIntegrity: sets.length > 0
      ? Math.round(sets.reduce((a, s) => a + s.integrity_score, 0) / sets.length) : 100,
  }

  if (loading) return (
    <div style={{ minHeight: '100vh', background: '#060608', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: 32, height: 32, border: '2px solid rgba(245,158,11,0.2)', borderTopColor: '#f59e0b', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
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
        @keyframes modalIn{from{opacity:0;transform:scale(0.95)}to{opacity:1;transform:scale(1)}}
      `}</style>

      {/* NAV */}
      <nav style={{ position: 'sticky', top: 0, zIndex: 100, background: 'rgba(6,6,8,0.9)', backdropFilter: 'blur(20px)', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 28px', height: 56 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={() => router.push('/supervisor')} style={{ background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.3)', fontSize: 18, cursor: 'pointer' }}>←</button>
          <span style={{ fontWeight: 800, fontSize: 15, color: '#f97316' }}>BrokenSet</span>
          <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.2)', fontFamily: "'JetBrains Mono',monospace" }}>/ STORAGE</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ padding: '4px 10px', borderRadius: 8, background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.15)' }}>
            <span style={{ fontSize: 11, color: '#f59e0b', fontWeight: 600, fontFamily: "'JetBrains Mono',monospace" }}>CP2 · STORAGE INTEGRITY</span>
          </div>
          <button onClick={() => router.push('/supervisor/inward')} style={{ padding: '6px 14px', borderRadius: 8, background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.2)', color: '#3b82f6', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
            + New Delivery
          </button>
        </div>
      </nav>

      <div style={{ padding: '28px', maxWidth: 1400, margin: '0 auto' }}>

        {/* HEADER */}
        <div style={{ marginBottom: 24, animation: 'fadeUp 0.4s ease' }}>
          <h1 style={{ fontSize: 28, fontWeight: 900, letterSpacing: '-1px' }}>
            Storage <span style={{ color: '#f59e0b' }}>Floor</span>
          </h1>
          <p style={{ color: 'rgba(255,255,255,0.28)', fontSize: 13, marginTop: 4 }}>
            {staff?.location?.name} · {sets.length} sets tracked · Every access logged
          </p>
        </div>

        {/* STATS ROW */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 12, marginBottom: 24 }}>
          {[
            { label: 'Total Sets',    value: stats.total,         color: '#fff' },
            { label: 'Complete',      value: stats.complete,      color: '#22c55e' },
            { label: 'Broken',        value: stats.broken,        color: '#ef4444' },
            { label: 'Dispatched',    value: stats.dispatched,    color: '#3b82f6' },
            { label: 'Avg Integrity', value: `${stats.avgIntegrity}%`, color: stats.avgIntegrity > 80 ? '#22c55e' : stats.avgIntegrity > 60 ? '#f59e0b' : '#ef4444' },
          ].map(({ label, value, color }) => (
            <div key={label} style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 12, padding: '14px 16px' }}>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', marginBottom: 8 }}>{label}</div>
              <div style={{ fontSize: 28, fontWeight: 900, color, letterSpacing: '-1px' }}>{value}</div>
            </div>
          ))}
        </div>

        {/* FILTERS */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
          {/* search */}
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search by QR code or product..."
            style={{ flex: 1, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, padding: '10px 14px', color: '#fff', fontSize: 13, outline: 'none' }}
            onFocus={e => (e.target.style.borderColor = 'rgba(245,158,11,0.4)')}
            onBlur={e => (e.target.style.borderColor = 'rgba(255,255,255,0.08)')}
          />

          {/* status filters */}
          <div style={{ display: 'flex', gap: 6 }}>
            {['all', 'complete', 'broken', 'opened', 'dispatched'].map(f => (
              <button key={f} onClick={() => setFilter(f)} style={{
                padding: '8px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600,
                cursor: 'pointer', transition: 'all 0.15s', textTransform: 'capitalize',
                background: filter === f ? 'rgba(245,158,11,0.15)' : 'rgba(255,255,255,0.03)',
                border: filter === f ? '1px solid rgba(245,158,11,0.3)' : '1px solid rgba(255,255,255,0.06)',
                color: filter === f ? '#f59e0b' : 'rgba(255,255,255,0.4)',
              }}>{f} {filter === f && `(${filtered.length})`}</button>
            ))}
          </div>
        </div>

        {/* SETS GRID */}
        {filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 60, color: 'rgba(255,255,255,0.15)' }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>📦</div>
            <div style={{ fontSize: 14 }}>No sets found. Log a delivery first.</div>
            <button onClick={() => router.push('/supervisor/inward')} style={{ marginTop: 16, padding: '10px 20px', borderRadius: 10, background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.2)', color: '#3b82f6', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
              Log First Delivery →
            </button>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 12 }}>
            {filtered.map((set: any, i: number) => {
              const cfg = STATUS_CONFIG[set.status] || STATUS_CONFIG.complete
              return (
                <div key={set.id} style={{
                  background: 'rgba(255,255,255,0.02)',
                  border: `1px solid ${selectedSet?.id === set.id ? cfg.border : 'rgba(255,255,255,0.05)'}`,
                  borderRadius: 14, padding: '16px',
                  cursor: 'pointer', transition: 'all 0.2s',
                  animation: `fadeUp 0.3s ease ${i * 0.02}s both`,
                }}
                  onClick={() => setSelectedSet(selectedSet?.id === set.id ? null : set)}
                  onMouseEnter={e => {
                    e.currentTarget.style.borderColor = cfg.border
                    e.currentTarget.style.transform = 'translateY(-2px)'
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.borderColor = selectedSet?.id === set.id ? cfg.border : 'rgba(255,255,255,0.05)'
                    e.currentTarget.style.transform = 'translateY(0)'
                  }}
                >
                  {/* Top row */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: '#fff', marginBottom: 3 }}>
                        {set.product?.name || 'Unknown'}
                      </div>
                      <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.25)', fontFamily: "'JetBrains Mono',monospace" }}>
                        {set.qr_code}
                      </div>
                    </div>
                    <div style={{ padding: '3px 8px', borderRadius: 6, background: cfg.bg, border: `1px solid ${cfg.border}`, fontSize: 10, fontWeight: 700, color: cfg.color, fontFamily: "'JetBrains Mono',monospace" }}>
                      {cfg.icon} {cfg.label}
                    </div>
                  </div>

                  {/* QR Code */}
                  <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12, padding: '10px', background: 'rgba(0,0,0,0.3)', borderRadius: 10 }}>
                    <QRCanvas value={set.qr_code} />
                  </div>

                  {/* Integrity bar */}
                  <div style={{ marginBottom: 12 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)' }}>Integrity</span>
                      <span style={{ fontSize: 10, fontWeight: 700, color: cfg.color, fontFamily: "'JetBrains Mono',monospace" }}>
                        {set.integrity_score}%
                      </span>
                    </div>
                    <div style={{ height: 3, background: 'rgba(255,255,255,0.06)', borderRadius: 99, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${set.integrity_score}%`, background: cfg.color, borderRadius: 99, transition: 'width 1s ease' }} />
                    </div>
                  </div>

                  {/* Info row */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                    <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.25)' }}>
                      {set.product?.pieces_per_set} pieces/set
                    </span>
                    <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.25)' }}>
                      {new Date(set.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                    </span>
                  </div>

                  {/* Audit button */}
                  {set.status !== 'dispatched' && (
                    <button onClick={e => { e.stopPropagation(); triggerAudit(set) }} style={{
                      width: '100%', padding: '8px', borderRadius: 8,
                      background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.15)',
                      color: '#f59e0b', fontSize: 11, fontWeight: 600, cursor: 'pointer',
                      transition: 'all 0.15s',
                    }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'rgba(245,158,11,0.12)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'rgba(245,158,11,0.06)')}
                    >
                      🔍 Trigger Spot Audit
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* AUDIT MODAL */}
      {auditModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: 20 }}
          onClick={() => !auditLoading && setAuditModal(null)}>
          <div style={{ background: '#0f0f12', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 20, padding: 32, width: '100%', maxWidth: 400, animation: 'modalIn 0.2s ease' }}
            onClick={e => e.stopPropagation()}>

            {auditSuccess ? (
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 48, marginBottom: 12 }}>
                  {Number(auditPieces) >= auditModal.product?.pieces_per_set ? '✅' : '🚫'}
                </div>
                <h3 style={{ fontSize: 20, fontWeight: 800, marginBottom: 8,
                  color: Number(auditPieces) >= auditModal.product?.pieces_per_set ? '#22c55e' : '#ef4444' }}>
                  {Number(auditPieces) >= auditModal.product?.pieces_per_set ? 'Set Verified!' : 'Discrepancy Found!'}
                </h3>
                <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', marginBottom: 24 }}>
                  {Number(auditPieces)}/{auditModal.product?.pieces_per_set} pieces confirmed.
                  {Number(auditPieces) < auditModal.product?.pieces_per_set && ' Alert sent to owner.'}
                </p>
                <button onClick={() => setAuditModal(null)} style={{ padding: '10px 24px', borderRadius: 10, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                  Close
                </button>
              </div>
            ) : (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                  <span style={{ fontSize: 20 }}>🔍</span>
                  <h3 style={{ fontSize: 18, fontWeight: 800 }}>Spot Audit</h3>
                </div>
                <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)', marginBottom: 24 }}>
                  Count the pieces in this set and enter the actual count below.
                </p>

                <div style={{ padding: '14px', borderRadius: 12, background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.15)', marginBottom: 20 }}>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{auditModal.product?.name}</div>
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', marginTop: 4, fontFamily: "'JetBrains Mono',monospace" }}>
                    {auditModal.qr_code} · Expected: {auditModal.product?.pieces_per_set} pieces
                  </div>
                </div>

                <label style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', fontWeight: 600, textTransform: 'uppercase', display: 'block', marginBottom: 8, fontFamily: "'JetBrains Mono',monospace" }}>
                  Actual Piece Count
                </label>
                <input
                  type="number" min="0" value={auditPieces}
                  onChange={e => setAuditPieces(e.target.value)}
                  placeholder={`Expected: ${auditModal.product?.pieces_per_set}`}
                  autoFocus
                  style={{ width: '100%', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: 10, padding: '14px', color: '#fff', fontSize: 18, fontWeight: 700, outline: 'none', textAlign: 'center', fontFamily: "'JetBrains Mono',monospace", marginBottom: 16 }}
                />

                {auditPieces && Number(auditPieces) < auditModal.product?.pieces_per_set && (
                  <div style={{ padding: '10px 14px', borderRadius: 10, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', marginBottom: 16 }}>
                    <p style={{ fontSize: 12, color: '#ef4444', fontWeight: 600 }}>
                      ⚠ {auditModal.product?.pieces_per_set - Number(auditPieces)} pieces missing — will flag discrepancy
                    </p>
                  </div>
                )}

                <div style={{ display: 'flex', gap: 10 }}>
                  <button onClick={() => setAuditModal(null)} style={{ flex: 1, padding: '12px', borderRadius: 10, background: 'transparent', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.4)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                    Cancel
                  </button>
                  <button onClick={confirmAudit} disabled={!auditPieces || auditLoading} style={{ flex: 2, padding: '12px', borderRadius: 10, background: auditLoading ? 'rgba(245,158,11,0.3)' : 'linear-gradient(135deg,#f59e0b,#d97706)', border: 'none', color: '#000', fontSize: 13, fontWeight: 700, cursor: auditLoading ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                    {auditLoading ? (
                      <div style={{ width: 16, height: 16, border: '2px solid rgba(0,0,0,0.3)', borderTopColor: '#000', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                    ) : '✓ Confirm Audit'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}