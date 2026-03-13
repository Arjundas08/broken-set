'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

const supabase = createClient()

export default function PackerHome() {
  const router = useRouter()
  const [staff, setStaff] = useState<any>(null)
  const [stats, setStats] = useState({ scanned: 0, approved: 0, blocked: 0 })
  const [recentLogs, setRecentLogs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { loadData() }, [])

  async function loadData() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }
    const { data: s } = await supabase
      .from('staff').select('*, location:locations(*)')
      .eq('id', user.id).single()
    setStaff(s)
    const { data: logs } = await supabase
      .from('access_logs')
      .select('*, set:sets(qr_code, product:products(name))')
      .eq('staff_id', user.id)
      .in('action', ['dispatched', 'flagged'])
      .order('created_at', { ascending: false })
      .limit(10)
    const approved = (logs || []).filter((l: any) => l.action === 'dispatched').length
    const blocked  = (logs || []).filter((l: any) => l.action === 'flagged').length
    setStats({ scanned: (logs || []).length, approved, blocked })
    setRecentLogs(logs || [])
    setLoading(false)
  }

  if (loading) return (
    <div style={{ minHeight: '100vh', background: '#060608', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: 32, height: 32, border: '2px solid rgba(34,197,94,0.2)', borderTopColor: '#22c55e', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
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
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}
      `}</style>

      <nav style={{ position: 'sticky', top: 0, zIndex: 100, background: 'rgba(6,6,8,0.9)', backdropFilter: 'blur(20px)', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 28px', height: 56 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontWeight: 800, fontSize: 16, color: '#f97316' }}>BrokenSet</span>
          <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.2)', marginLeft: 8, fontFamily: "'JetBrains Mono',monospace" }}>PACKER</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 99, background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.15)' }}>
            <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#22c55e', animation: 'pulse 2s ease-in-out infinite' }} />
            <span style={{ fontSize: 11, color: '#22c55e', fontWeight: 600 }}>{staff?.location?.name || 'No location'}</span>
          </div>
          <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>{staff?.name}</span>
          <button onClick={async () => { await supabase.auth.signOut(); router.push('/login') }}
            style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 7, padding: '5px 12px', color: 'rgba(255,255,255,0.25)', fontSize: 12, cursor: 'pointer' }}>
            Logout
          </button>
        </div>
      </nav>

      <div style={{ padding: '28px', maxWidth: 800, margin: '0 auto' }}>
        <div style={{ marginBottom: 28, animation: 'fadeUp 0.4s ease' }}>
          <h1 style={{ fontSize: 30, fontWeight: 900, letterSpacing: '-1px' }}>
            Packer <span style={{ color: '#22c55e' }}>Station</span>
          </h1>
          <p style={{ color: 'rgba(255,255,255,0.28)', fontSize: 13, marginTop: 4 }}>
            Scan every set before dispatch · Your sign-off is permanent
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: 24 }}>
          {[
            { label: 'Total Scanned',  value: stats.scanned,  color: '#fff' },
            { label: 'Approved',       value: stats.approved, color: '#22c55e' },
            { label: 'Blocked by You', value: stats.blocked,  color: '#ef4444' },
          ].map(({ label, value, color }) => (
            <div key={label} style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 14, padding: '18px' }}>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', marginBottom: 8 }}>{label}</div>
              <div style={{ fontSize: 36, fontWeight: 900, color, letterSpacing: '-2px' }}>{value}</div>
            </div>
          ))}
        </div>

        <button onClick={() => router.push('/packer/scan')} style={{
          width: '100%', padding: '32px', borderRadius: 20,
          background: 'linear-gradient(135deg, rgba(34,197,94,0.15), rgba(34,197,94,0.05))',
          border: '1px solid rgba(34,197,94,0.3)', cursor: 'pointer', marginBottom: 24,
        }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>📷</div>
          <h2 style={{ fontSize: 22, fontWeight: 800, color: '#22c55e', letterSpacing: '-0.5px', marginBottom: 8 }}>
            Scan Set to Verify
          </h2>
          <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.35)', lineHeight: 1.6 }}>
            Scan QR code → count pieces → confirm dispatch<br />
            <span style={{ color: '#ef4444', fontWeight: 600 }}>Broken sets will be BLOCKED automatically</span>
          </p>
          <div style={{ marginTop: 16, display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 20px', borderRadius: 99, background: 'rgba(34,197,94,0.15)', border: '1px solid rgba(34,197,94,0.25)' }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: '#22c55e' }}>CP3 · Start Scanning →</span>
          </div>
        </button>

        <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 16, overflow: 'hidden' }}>
          <div style={{ padding: '16px 22px', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
            <h3 style={{ fontSize: 14, fontWeight: 700 }}>Your Recent Scans</h3>
          </div>
          {recentLogs.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'rgba(255,255,255,0.15)', fontSize: 13 }}>
              No scans yet. Start scanning sets!
            </div>
          ) : recentLogs.map((log: any) => (
            <div key={log.id} style={{ padding: '14px 22px', borderBottom: '1px solid rgba(255,255,255,0.03)', display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ fontSize: 20 }}>{log.action === 'dispatched' ? '✅' : '🚫'}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 2 }}>{log.set?.product?.name || 'Unknown'}</div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)' }}>
                  {log.set?.qr_code} · {log.pieces_confirmed}/{log.expected_pieces} pieces
                </div>
              </div>
              <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 4, fontWeight: 700,
                background: log.action === 'dispatched' ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
                color: log.action === 'dispatched' ? '#22c55e' : '#ef4444' }}>
                {log.action === 'dispatched' ? 'APPROVED' : 'BLOCKED'}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}