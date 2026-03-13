'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { Html5QrcodeScanner } from 'html5-qrcode'

const supabase = createClient()

type ScanState = 'idle' | 'scanning' | 'confirming' | 'approved' | 'blocked'

export default function PackerScanPage() {
  const router                            = useRouter()
  const [staff, setStaff]                 = useState<any>(null)
  const [state, setState]                 = useState<ScanState>('idle')
  const [scannedQR, setScannedQR]         = useState('')
  const [manualQR, setManualQR]           = useState('')
  const [pieces, setPieces]               = useState('')
  const [result, setResult]               = useState<any>(null)
  const [loading, setLoading]             = useState(false)
  const [error, setError]                 = useState('')
  const [useManual, setUseManual]         = useState(false)
  const scannerRef                        = useRef<Html5QrcodeScanner | null>(null)
  const scannerDivRef                     = useRef<HTMLDivElement>(null)

  useEffect(() => {
    loadUser()
    return () => { scannerRef.current?.clear().catch(() => {}) }
  }, [])

  async function loadUser() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }
    const { data: s } = await supabase.from('staff').select('*, location:locations(*)').eq('id', user.id).single()
    setStaff(s)
  }

  function startScanner() {
    setState('scanning')
    setTimeout(() => {
      if (!scannerDivRef.current) return
      scannerRef.current = new Html5QrcodeScanner('qr-reader', { fps: 10, qrbox: 200 }, false)
      scannerRef.current.render(
        (decoded) => {
          scannerRef.current?.clear().catch(() => {})
          setScannedQR(decoded)
          setState('confirming')
        },
        () => {}
      )
    }, 300)
  }

  function stopScanner() {
    scannerRef.current?.clear().catch(() => {})
    setState('idle')
  }

  async function handleVerify() {
    const qr = useManual ? manualQR : scannedQR
    if (!qr || !pieces || !staff) return
    setLoading(true)
    setError('')

    try {
      const res = await fetch('/api/dispatch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          qr_code:          qr,
          pieces_confirmed: Number(pieces),
          staff_id:         staff.id,
        }),
      })
      const data = await res.json()

      if (data.error) throw new Error(data.error)

      setResult(data)
      setState(data.approved ? 'approved' : 'blocked')
    } catch (e: any) {
      setError(e.message)
    }
    setLoading(false)
  }

  function reset() {
    setState('idle')
    setScannedQR('')
    setManualQR('')
    setPieces('')
    setResult(null)
    setError('')
    setUseManual(false)
  }

  return (
    <div style={{ minHeight: '100vh', background: '#060608', color: '#fff', fontFamily: "'DM Sans',system-ui,sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;600&display=swap');
        *{box-sizing:border-box;margin:0;padding:0}
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes fadeUp{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}
        @keyframes blockPulse{0%,100%{box-shadow:0 0 0 0 rgba(239,68,68,0.4)}50%{box-shadow:0 0 0 20px rgba(239,68,68,0)}}
        @keyframes approvedPulse{0%,100%{box-shadow:0 0 0 0 rgba(34,197,94,0.4)}50%{box-shadow:0 0 0 20px rgba(34,197,94,0)}}
        #qr-reader{border:none!important;background:transparent!important}
        #qr-reader video{border-radius:12px!important}
        #qr-reader__scan_region{border-radius:12px!important}
      `}</style>

      {/* NAV */}
      <nav style={{ position: 'sticky', top: 0, zIndex: 100, background: 'rgba(6,6,8,0.9)', backdropFilter: 'blur(20px)', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 28px', height: 56 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={() => { stopScanner(); router.push('/packer') }} style={{ background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.3)', fontSize: 18, cursor: 'pointer' }}>←</button>
          <span style={{ fontWeight: 800, fontSize: 15, color: '#f97316' }}>BrokenSet</span>
          <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.2)', fontFamily: "'JetBrains Mono',monospace" }}>/ SCAN & VERIFY</span>
        </div>
        <div style={{ padding: '4px 10px', borderRadius: 8, background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.15)' }}>
          <span style={{ fontSize: 11, color: '#22c55e', fontWeight: 600, fontFamily: "'JetBrains Mono',monospace" }}>CP3 · OUTWARD VERIFICATION</span>
        </div>
      </nav>

      <div style={{ padding: '28px', maxWidth: 520, margin: '0 auto' }}>

        {/* ── IDLE STATE ── */}
        {state === 'idle' && (
          <div style={{ animation: 'fadeUp 0.4s ease' }}>
            <div style={{ marginBottom: 28 }}>
              <h1 style={{ fontSize: 28, fontWeight: 900, letterSpacing: '-1px' }}>
                Verify <span style={{ color: '#22c55e' }}>Set</span>
              </h1>
              <p style={{ color: 'rgba(255,255,255,0.28)', fontSize: 13, marginTop: 4 }}>
                Scan the QR code on the set packaging
              </p>
            </div>

            {/* SCAN button */}
            <button onClick={startScanner} style={{
              width: '100%', padding: '40px 20px', borderRadius: 20, marginBottom: 16,
              background: 'linear-gradient(135deg, rgba(34,197,94,0.12), rgba(34,197,94,0.04))',
              border: '2px dashed rgba(34,197,94,0.3)', cursor: 'pointer',
              transition: 'all 0.2s',
            }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(34,197,94,0.6)'; e.currentTarget.style.background = 'linear-gradient(135deg, rgba(34,197,94,0.2), rgba(34,197,94,0.08))' }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(34,197,94,0.3)'; e.currentTarget.style.background = 'linear-gradient(135deg, rgba(34,197,94,0.12), rgba(34,197,94,0.04))' }}
            >
              <div style={{ fontSize: 52, marginBottom: 12 }}>📷</div>
              <div style={{ fontSize: 18, fontWeight: 800, color: '#22c55e', marginBottom: 6 }}>Open Camera Scanner</div>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)' }}>Point camera at QR code on set label</div>
            </button>

            {/* Manual entry toggle */}
            <div style={{ textAlign: 'center', marginBottom: 16 }}>
              <button onClick={() => setUseManual(!useManual)} style={{ background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.3)', fontSize: 12, cursor: 'pointer', textDecoration: 'underline' }}>
                {useManual ? 'Use camera instead' : 'Enter QR code manually'}
              </button>
            </div>

            {useManual && (
              <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, padding: 20, animation: 'fadeUp 0.3s ease' }}>
                <label style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', fontWeight: 600, textTransform: 'uppercase', display: 'block', marginBottom: 8, fontFamily: "'JetBrains Mono',monospace" }}>
                  QR Code
                </label>
                <input value={manualQR} onChange={e => setManualQR(e.target.value)}
                  placeholder="e.g. SET-ABC123-001"
                  style={{ width: '100%', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, padding: '12px 14px', color: '#fff', fontSize: 14, outline: 'none', fontFamily: "'JetBrains Mono',monospace", marginBottom: 12 }}
                  onFocus={e => (e.target.style.borderColor = 'rgba(34,197,94,0.4)')}
                  onBlur={e => (e.target.style.borderColor = 'rgba(255,255,255,0.1)')}
                />
                <label style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', fontWeight: 600, textTransform: 'uppercase', display: 'block', marginBottom: 8, fontFamily: "'JetBrains Mono',monospace" }}>
                  Piece Count
                </label>
                <input type="number" value={pieces} onChange={e => setPieces(e.target.value)}
                  placeholder="How many pieces?"
                  style={{ width: '100%', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, padding: '12px 14px', color: '#fff', fontSize: 14, outline: 'none', marginBottom: 12 }}
                  onFocus={e => (e.target.style.borderColor = 'rgba(34,197,94,0.4)')}
                  onBlur={e => (e.target.style.borderColor = 'rgba(255,255,255,0.1)')}
                />
                {error && <div style={{ padding: '10px 12px', borderRadius: 8, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#ef4444', fontSize: 12, marginBottom: 12 }}>{error}</div>}
                <button onClick={handleVerify} disabled={!manualQR || !pieces || loading} style={{
                  width: '100%', padding: '13px', borderRadius: 10,
                  background: loading ? 'rgba(34,197,94,0.3)' : 'linear-gradient(135deg,#22c55e,#16a34a)',
                  border: 'none', color: '#000', fontSize: 14, fontWeight: 700,
                  cursor: !manualQR || !pieces || loading ? 'not-allowed' : 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                }}>
                  {loading ? <div style={{ width: 16, height: 16, border: '2px solid rgba(0,0,0,0.3)', borderTopColor: '#000', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} /> : '✓ Verify & Check Dispatch'}
                </button>
              </div>
            )}

            {/* Info card */}
            <div style={{ marginTop: 20, padding: '16px', borderRadius: 12, background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.04)' }}>
              <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.2)', fontFamily: "'JetBrains Mono',monospace", marginBottom: 10 }}>WHAT HAPPENS WHEN YOU SCAN</p>
              {[
                { icon: '📷', text: 'QR scanned → set identified instantly' },
                { icon: '🔢', text: 'You enter actual piece count' },
                { icon: '✅', text: 'Match → dispatch approved & logged' },
                { icon: '🚫', text: 'Mismatch → dispatch BLOCKED, owner alerted' },
              ].map(({ icon, text }) => (
                <div key={text} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '5px 0' }}>
                  <span>{icon}</span>
                  <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)' }}>{text}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── SCANNING STATE ── */}
        {state === 'scanning' && (
          <div style={{ animation: 'fadeUp 0.3s ease' }}>
            <div style={{ marginBottom: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h2 style={{ fontSize: 20, fontWeight: 800 }}>Scanning...</h2>
              <button onClick={stopScanner} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '6px 14px', color: 'rgba(255,255,255,0.5)', fontSize: 12, cursor: 'pointer' }}>
                Cancel
              </button>
            </div>
            <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(34,197,94,0.2)', borderRadius: 16, overflow: 'hidden', padding: 16 }}>
              <div id="qr-reader" ref={scannerDivRef} style={{ width: '100%' }} />
            </div>
            <p style={{ textAlign: 'center', fontSize: 12, color: 'rgba(255,255,255,0.25)', marginTop: 12 }}>
              Point camera at the QR code on the set label
            </p>
          </div>
        )}

        {/* ── CONFIRMING STATE ── */}
        {state === 'confirming' && (
          <div style={{ animation: 'fadeUp 0.4s ease' }}>
            <div style={{ marginBottom: 24 }}>
              <h2 style={{ fontSize: 24, fontWeight: 900, letterSpacing: '-0.5px' }}>
                Set <span style={{ color: '#22c55e' }}>Identified</span>
              </h2>
              <p style={{ color: 'rgba(255,255,255,0.28)', fontSize: 13, marginTop: 4 }}>
                Now count and enter the actual piece count
              </p>
            </div>

            {/* QR result */}
            <div style={{ padding: '16px 20px', borderRadius: 14, background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.2)', marginBottom: 20 }}>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', fontFamily: "'JetBrains Mono',monospace", marginBottom: 4 }}>QR SCANNED</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#22c55e', fontFamily: "'JetBrains Mono',monospace" }}>{scannedQR}</div>
            </div>

            {/* Piece input */}
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', fontWeight: 600, textTransform: 'uppercase', display: 'block', marginBottom: 8, fontFamily: "'JetBrains Mono',monospace" }}>
                Actual Piece Count
              </label>
              <input
                type="number" min="0" value={pieces}
                onChange={e => setPieces(e.target.value)}
                placeholder="Count pieces and enter here"
                autoFocus
                style={{ width: '100%', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(34,197,94,0.3)', borderRadius: 12, padding: '18px', color: '#fff', fontSize: 24, fontWeight: 700, outline: 'none', textAlign: 'center', fontFamily: "'JetBrains Mono',monospace" }}
              />
            </div>

            {error && (
              <div style={{ padding: '12px 14px', borderRadius: 10, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#ef4444', fontSize: 13, marginBottom: 16 }}>
                {error}
              </div>
            )}

            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => { setState('idle'); setScannedQR(''); setPieces('') }} style={{ flex: 1, padding: '13px', borderRadius: 10, background: 'transparent', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.4)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                Rescan
              </button>
              <button onClick={handleVerify} disabled={!pieces || loading} style={{
                flex: 2, padding: '13px', borderRadius: 10,
                background: loading ? 'rgba(34,197,94,0.3)' : 'linear-gradient(135deg,#22c55e,#16a34a)',
                border: 'none', color: '#000', fontSize: 14, fontWeight: 700,
                cursor: !pieces || loading ? 'not-allowed' : 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              }}>
                {loading ? <div style={{ width: 16, height: 16, border: '2px solid rgba(0,0,0,0.3)', borderTopColor: '#000', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} /> : '✓ Verify & Check Dispatch'}
              </button>
            </div>
          </div>
        )}

        {/* ── APPROVED STATE ── */}
        {state === 'approved' && (
          <div style={{ textAlign: 'center', padding: '48px 20px', animation: 'fadeUp 0.4s ease' }}>
            <div style={{ width: 100, height: 100, borderRadius: '50%', background: 'rgba(34,197,94,0.15)', border: '2px solid rgba(34,197,94,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 48, margin: '0 auto 24px', animation: 'approvedPulse 2s ease infinite' }}>
              ✅
            </div>
            <h2 style={{ fontSize: 32, fontWeight: 900, color: '#22c55e', letterSpacing: '-1px', marginBottom: 8 }}>
              DISPATCH APPROVED
            </h2>
            <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 14, marginBottom: 24, lineHeight: 1.6 }}>
              {result?.set_name} verified<br />
              {result?.pieces} pieces confirmed · Logged under {staff?.name}
            </p>
            <div style={{ padding: '14px 20px', borderRadius: 12, background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.15)', marginBottom: 24, display: 'inline-block' }}>
              <p style={{ fontSize: 12, color: '#22c55e', fontFamily: "'JetBrains Mono',monospace" }}>
                ✓ Chain of custody updated · Set marked dispatched
              </p>
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
              <button onClick={reset} style={{ padding: '12px 28px', borderRadius: 10, background: 'linear-gradient(135deg,#22c55e,#16a34a)', border: 'none', color: '#000', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
                Scan Next Set →
              </button>
            </div>
          </div>
        )}

        {/* ── BLOCKED STATE ── */}
        {state === 'blocked' && (
          <div style={{ textAlign: 'center', padding: '48px 20px', animation: 'fadeUp 0.4s ease' }}>
            <div style={{ width: 100, height: 100, borderRadius: '50%', background: 'rgba(239,68,68,0.15)', border: '2px solid rgba(239,68,68,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 48, margin: '0 auto 24px', animation: 'blockPulse 2s ease infinite' }}>
              🚫
            </div>
            <h2 style={{ fontSize: 32, fontWeight: 900, color: '#ef4444', letterSpacing: '-1px', marginBottom: 8 }}>
              DISPATCH BLOCKED
            </h2>
            <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 14, marginBottom: 24, lineHeight: 1.6 }}>
              {result?.set_name}<br />
              Expected <span style={{ color: '#fff', fontWeight: 700 }}>{result?.expected}</span> pieces · Got <span style={{ color: '#ef4444', fontWeight: 700 }}>{result?.actual}</span> pieces
            </p>

            <div style={{ padding: '16px 20px', borderRadius: 12, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', marginBottom: 24 }}>
              <p style={{ fontSize: 13, color: '#ef4444', fontWeight: 700, marginBottom: 6 }}>
                🚨 {result?.delta} piece{result?.delta !== 1 ? 's' : ''} missing
              </p>
              <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', lineHeight: 1.6 }}>
                Discrepancy logged · Owner alerted · Your name recorded<br />
                This set cannot leave the warehouse
              </p>
            </div>

            <div style={{ padding: '12px 20px', borderRadius: 10, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', marginBottom: 24, display: 'inline-block' }}>
              <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', fontFamily: "'JetBrains Mono',monospace" }}>
                Logged: {staff?.name} · {new Date().toLocaleTimeString('en-IN')} · {staff?.location?.name}
              </p>
            </div>

            <button onClick={reset} style={{ padding: '12px 28px', borderRadius: 10, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', color: '#ef4444', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
              Scan Another Set
            </button>
          </div>
        )}
      </div>
    </div>
  )
}