'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

const supabase = createClient()

export default function StaffPage() {
  const router = useRouter()
  const [staffList, setStaffList] = useState<any[]>([])
  const [loading, setLoading]     = useState(true)

  useEffect(() => { loadData() }, [])

  async function loadData() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }

    const { data: staff } = await supabase
      .from('staff')
      .select('*, location:locations(name)')
      .order('name')

    if (!staff) { setLoading(false); return }

    const enriched = await Promise.all(staff.map(async (s: any) => {
      const { data: logs } = await supabase
        .from('access_logs')
        .select('id, action, pieces_confirmed, expected_pieces')
        .eq('staff_id', s.id)

      const { data: discs } = await supabase
        .from('discrepancies')
        .select('id, delta')
        .eq('reported_by', s.id)

      const totalScans    = (logs || []).length
      const flaggedScans  = (logs || []).filter((l: any) => l.action === 'flagged').length
      const totalLoss     = (discs || []).reduce((a: number, d: any) => a + Math.abs(d.delta || 0), 0)
      const riskScore     = Math.min(100, flaggedScans * 20 + totalLoss * 5)
      const riskLevel     = riskScore > 60 ? 'HIGH' : riskScore > 30 ? 'MEDIUM' : 'LOW'

      return { ...s, totalScans, flaggedScans, totalLoss, riskScore, riskLevel }
    }))

    enriched.sort((a, b) => b.riskScore - a.riskScore)
    setStaffList(enriched)
    setLoading(false)
  }

  const riskColor = (level: string) =>
    level === 'HIGH' ? '#ef4444' : level === 'MEDIUM' ? '#f59e0b' : '#22c55e'

  if (loading) return (
    <div style={{ minHeight: '100vh', background: '#060608', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: 32, height: 32, border: '2px solid rgba(249,115,22,0.2)', borderTopColor: '#f97316', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
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
          <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.2)', fontFamily: "'JetBrains Mono',monospace" }}>/ STAFF RISK</span>
        </div>
      </nav>

      <div style={{ padding: '28px', maxWidth: 900, margin: '0 auto' }}>
        <div style={{ marginBottom: 24, animation: 'fadeUp 0.4s ease' }}>
          <h1 style={{ fontSize: 28, fontWeight: 900, letterSpacing: '-1px' }}>
            Staff <span style={{ color: '#f97316' }}>Risk Board</span>
          </h1>
          <p style={{ color: 'rgba(255,255,255,0.28)', fontSize: 13, marginTop: 4 }}>
            Ranked by discrepancy correlation · Higher score = higher investigation priority
          </p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {staffList.map((s: any, i: number) => (
            <div key={s.id} style={{
              background: 'rgba(255,255,255,0.02)',
              border: `1px solid ${s.riskLevel === 'HIGH' ? 'rgba(239,68,68,0.2)' : 'rgba(255,255,255,0.05)'}`,
              borderRadius: 16, padding: '20px 24px',
              animation: `fadeUp 0.3s ease ${i * 0.07}s both`,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                {/* Avatar */}
                <div style={{ width: 48, height: 48, borderRadius: '50%', flexShrink: 0,
                  background: `linear-gradient(135deg,${riskColor(s.riskLevel)}33,${riskColor(s.riskLevel)}11)`,
                  border: `2px solid ${riskColor(s.riskLevel)}44`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 18, fontWeight: 800, color: riskColor(s.riskLevel) }}>
                  {s.name?.[0]}
                </div>

                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                    <span style={{ fontSize: 16, fontWeight: 700 }}>{s.name}</span>
                    <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 4, fontWeight: 800, fontFamily: "'JetBrains Mono',monospace",
                      background: `${riskColor(s.riskLevel)}18`, color: riskColor(s.riskLevel) }}>
                      {s.riskLevel} RISK
                    </span>
                    <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', textTransform: 'capitalize' }}>{s.role}</span>
                  </div>
                  <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)', marginBottom: 10 }}>
                    {s.location?.name} · {s.shift} shift · {s.totalScans} total scans
                  </div>

                  {/* Risk bar */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ flex: 1, height: 4, background: 'rgba(255,255,255,0.06)', borderRadius: 99, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${s.riskScore}%`, background: riskColor(s.riskLevel), borderRadius: 99, transition: 'width 1s ease' }} />
                    </div>
                    <span style={{ fontSize: 11, fontWeight: 700, color: riskColor(s.riskLevel), fontFamily: "'JetBrains Mono',monospace", minWidth: 40 }}>
                      {s.riskScore}%
                    </span>
                  </div>
                </div>

                {/* Stats */}
                <div style={{ display: 'flex', gap: 20, flexShrink: 0 }}>
                  {[
                    { label: 'Flags',       value: s.flaggedScans, color: '#ef4444' },
                    { label: 'Pieces Lost', value: s.totalLoss,    color: '#f59e0b' },
                  ].map(({ label, value, color }) => (
                    <div key={label} style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: 24, fontWeight: 900, color, letterSpacing: '-1px' }}>{value}</div>
                      <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.25)' }}>{label}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}