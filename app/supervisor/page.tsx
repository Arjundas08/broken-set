'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

const supabase = createClient()

export default function InwardPage() {
  const router = useRouter()
  const [staff, setStaff]         = useState<any>(null)
  const [suppliers, setSuppliers] = useState<any[]>([])
  const [products, setProducts]   = useState<any[]>([])
  const [loading, setLoading]     = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [ocrLoading, setOcrLoading] = useState(false)
  const [success, setSuccess]     = useState<any>(null)
  const [error, setError]         = useState('')
  const fileRef                   = useRef<HTMLInputElement>(null)

  const [form, setForm] = useState({
    supplier_id:     '',
    product_id:      '',
    sets_billed:     '',
    sets_received:   '',
    pieces_billed:   '',
    pieces_received: '',
    notes:           '',
  })

  const [ocrResult, setOcrResult] = useState<any>(null)

  useEffect(() => { loadData() }, [])

  async function loadData() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }
    const { data: s } = await supabase.from('staff').select('*, location:locations(*)').eq('id', user.id).single()
    setStaff(s)
    const [{ data: sups }, { data: prods }] = await Promise.all([
      supabase.from('suppliers').select('*').order('name'),
      supabase.from('products').select('*').order('name'),
    ])
    setSuppliers(sups || [])
    setProducts(prods || [])
    setLoading(false)
  }

  function set(key: string, val: string) {
    setForm(f => ({ ...f, [key]: val }))
  }

  // Auto-calculate pieces when sets or product changes
  useEffect(() => {
    if (form.product_id && form.sets_billed) {
      const prod = products.find(p => p.id === form.product_id)
      if (prod) {
        set('pieces_billed', String(Number(form.sets_billed) * prod.pieces_per_set))
      }
    }
  }, [form.product_id, form.sets_billed])

  useEffect(() => {
    if (form.product_id && form.sets_received) {
      const prod = products.find(p => p.id === form.product_id)
      if (prod) {
        set('pieces_received', String(Number(form.sets_received) * prod.pieces_per_set))
      }
    }
  }, [form.product_id, form.sets_received])

  async function handleOCR(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setOcrLoading(true)
    setError('')

    try {
      const reader = new FileReader()
      reader.onload = async () => {
        const base64 = (reader.result as string).split(',')[1]
        const res = await fetch('/api/ai/ocr', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ image_base64: base64 }),
        })
        const data = await res.json()
        if (data.error) throw new Error(data.error)

        setOcrResult(data)

        // Auto-fill form
        if (data.matched_supplier_id) set('supplier_id', data.matched_supplier_id)
        if (data.matched_product_id)  set('product_id',  data.matched_product_id)
        if (data.sets_count)          set('sets_billed',     String(data.sets_count))
        if (data.sets_count)          set('sets_received',   String(data.sets_count))
        if (data.total_pieces)        set('pieces_billed',   String(data.total_pieces))
        if (data.total_pieces)        set('pieces_received', String(data.total_pieces))
        setOcrLoading(false)
      }
      reader.readAsDataURL(file)
    } catch (e: any) {
      setError('OCR failed: ' + e.message)
      setOcrLoading(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError('')

    try {
      const res = await fetch('/api/inward', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          location_id: staff?.location_id,
          received_by: staff?.id,
        }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setSuccess(data)
    } catch (e: any) {
      setError(e.message)
    }
    setSubmitting(false)
  }

  const selectedProduct  = products.find(p => p.id === form.product_id)
  const selectedSupplier = suppliers.find(s => s.id === form.supplier_id)
  const hasShortfall     = form.pieces_received && form.pieces_billed &&
    Number(form.pieces_received) < Number(form.pieces_billed)

  if (loading) return (
    <div style={{ minHeight: '100vh', background: '#060608', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: 32, height: 32, border: '2px solid rgba(59,130,246,0.2)', borderTopColor: '#3b82f6', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )

  // SUCCESS SCREEN
  if (success) return (
    <div style={{ minHeight: '100vh', background: '#060608', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'DM Sans',system-ui,sans-serif" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;600;700;800&family=JetBrains+Mono:wght@400;600&display=swap');*{box-sizing:border-box;margin:0;padding:0}@keyframes fadeUp{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}`}</style>
      <div style={{ textAlign: 'center', padding: 48, animation: 'fadeUp 0.5s ease' }}>
        <div style={{ fontSize: 64, marginBottom: 16 }}>✅</div>
        <h2 style={{ fontSize: 28, fontWeight: 900, color: '#22c55e', letterSpacing: '-1px', marginBottom: 8 }}>
          Delivery Logged!
        </h2>
        <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 14, marginBottom: 24 }}>
          {success.sets_created} QR codes generated · Chain of custody started
        </p>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
          <button onClick={() => { setSuccess(null); setForm({ supplier_id:'', product_id:'', sets_billed:'', sets_received:'', pieces_billed:'', pieces_received:'', notes:'' }); setOcrResult(null) }}
            style={{ padding: '12px 24px', borderRadius: 10, background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.25)', color: '#3b82f6', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
            Log Another
          </button>
          <button onClick={() => router.push('/supervisor/storage')}
            style={{ padding: '12px 24px', borderRadius: 10, background: 'linear-gradient(135deg,#3b82f6,#1d4ed8)', border: 'none', color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
            View Storage →
          </button>
        </div>
      </div>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: '#060608', color: '#fff', fontFamily: "'DM Sans',system-ui,sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;600&display=swap');
        *{box-sizing:border-box;margin:0;padding:0}
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes fadeUp{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
        select option{background:#1a1a1a;color:#fff}
      `}</style>

      {/* NAV */}
      <nav style={{ position: 'sticky', top: 0, zIndex: 100, background: 'rgba(6,6,8,0.9)', backdropFilter: 'blur(20px)', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 28px', height: 56 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={() => router.push('/supervisor')} style={{ background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.3)', fontSize: 18, cursor: 'pointer' }}>←</button>
          <span style={{ fontWeight: 800, fontSize: 15, color: '#f97316' }}>BrokenSet</span>
          <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.2)', fontFamily: "'JetBrains Mono',monospace" }}>/ INWARD</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 10px', borderRadius: 8, background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.15)' }}>
          <span style={{ fontSize: 11, color: '#3b82f6', fontWeight: 600, fontFamily: "'JetBrains Mono',monospace" }}>CP1 · INWARD VERIFICATION</span>
        </div>
      </nav>

      <div style={{ padding: '28px', maxWidth: 900, margin: '0 auto' }}>

        {/* HEADER */}
        <div style={{ marginBottom: 28, animation: 'fadeUp 0.4s ease' }}>
          <h1 style={{ fontSize: 28, fontWeight: 900, letterSpacing: '-1px' }}>
            Log Inward <span style={{ color: '#3b82f6' }}>Delivery</span>
          </h1>
          <p style={{ color: 'rgba(255,255,255,0.28)', fontSize: 13, marginTop: 4 }}>
            Verify supplier delivery · Generate QR codes · Start chain of custody
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 20 }}>

          {/* FORM */}
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

            {/* Bill OCR */}
            <div style={{ background: 'rgba(168,85,247,0.05)', border: '1px solid rgba(168,85,247,0.2)', borderRadius: 14, padding: '20px', animation: 'fadeUp 0.4s ease' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <span style={{ fontSize: 16 }}>⚡</span>
                <h3 style={{ fontSize: 14, fontWeight: 700, color: '#a855f7' }}>AI Bill OCR</h3>
                <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, background: 'rgba(168,85,247,0.1)', color: '#a855f7', fontFamily: "'JetBrains Mono',monospace" }}>POWERED BY CLAUDE</span>
              </div>
              <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)', marginBottom: 14 }}>
                Photo the supplier invoice → form fills automatically
              </p>

              <input ref={fileRef} type="file" accept="image/*" onChange={handleOCR} style={{ display: 'none' }} />

              <button type="button" onClick={() => fileRef.current?.click()} disabled={ocrLoading}
                style={{ width: '100%', padding: '12px', borderRadius: 10, cursor: ocrLoading ? 'not-allowed' : 'pointer', background: 'rgba(168,85,247,0.1)', border: '1px dashed rgba(168,85,247,0.3)', color: '#a855f7', fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                {ocrLoading ? (
                  <>
                    <div style={{ width: 16, height: 16, border: '2px solid rgba(168,85,247,0.3)', borderTopColor: '#a855f7', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                    Reading bill...
                  </>
                ) : '📷 Upload Bill Photo'}
              </button>

              {ocrResult && (
                <div style={{ marginTop: 12, padding: '10px 14px', borderRadius: 8, background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.15)' }}>
                  <p style={{ fontSize: 11, color: '#22c55e', fontWeight: 600, marginBottom: 4 }}>✓ Claude extracted:</p>
                  <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', fontFamily: "'JetBrains Mono',monospace" }}>
                    {ocrResult.supplier_name} · {ocrResult.product_name} · {ocrResult.sets_count} sets · {ocrResult.total_pieces} pieces
                  </p>
                  <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.2)', marginTop: 4 }}>
                    Confidence: {ocrResult.confidence}%
                  </p>
                </div>
              )}
            </div>

            {/* Supplier */}
            <div style={{ animation: 'fadeUp 0.4s ease 0.05s both' }}>
              <label style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', marginBottom: 8, fontFamily: "'JetBrains Mono',monospace" }}>
                Supplier
              </label>
              <select value={form.supplier_id} onChange={e => set('supplier_id', e.target.value)} required
                style={{ width: '100%', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, padding: '12px 14px', color: form.supplier_id ? '#fff' : 'rgba(255,255,255,0.3)', fontSize: 14, outline: 'none', cursor: 'pointer' }}>
                <option value="">Select supplier...</option>
                {suppliers.map(s => (
                  <option key={s.id} value={s.id}>{s.name} — Trust: {s.trust_score}%</option>
                ))}
              </select>
              {selectedSupplier && (
                <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <div style={{ height: 4, flex: 1, background: 'rgba(255,255,255,0.06)', borderRadius: 99, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${selectedSupplier.trust_score}%`, background: selectedSupplier.trust_score > 80 ? '#22c55e' : selectedSupplier.trust_score > 60 ? '#f59e0b' : '#ef4444', borderRadius: 99, transition: 'width 0.5s ease' }} />
                  </div>
                  <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', fontFamily: "'JetBrains Mono',monospace" }}>
                    {selectedSupplier.trust_score}% trust
                  </span>
                </div>
              )}
            </div>

            {/* Product */}
            <div style={{ animation: 'fadeUp 0.4s ease 0.1s both' }}>
              <label style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', marginBottom: 8, fontFamily: "'JetBrains Mono',monospace" }}>
                Product / Set Type
              </label>
              <select value={form.product_id} onChange={e => set('product_id', e.target.value)} required
                style={{ width: '100%', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, padding: '12px 14px', color: form.product_id ? '#fff' : 'rgba(255,255,255,0.3)', fontSize: 14, outline: 'none', cursor: 'pointer' }}>
                <option value="">Select product...</option>
                {products.map(p => (
                  <option key={p.id} value={p.id}>{p.name} ({p.pieces_per_set} pieces/set)</option>
                ))}
              </select>
            </div>

            {/* Sets row */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, animation: 'fadeUp 0.4s ease 0.15s both' }}>
              {[
                { label: 'Sets on Bill', key: 'sets_billed', placeholder: '100' },
                { label: 'Sets Actually Received', key: 'sets_received', placeholder: '100' },
              ].map(({ label, key, placeholder }) => (
                <div key={key}>
                  <label style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', marginBottom: 8, fontFamily: "'JetBrains Mono',monospace" }}>
                    {label}
                  </label>
                  <input type="number" min="0" value={form[key as keyof typeof form]}
                    onChange={e => set(key, e.target.value)}
                    placeholder={placeholder} required
                    style={{ width: '100%', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, padding: '12px 14px', color: '#fff', fontSize: 14, outline: 'none' }}
                    onFocus={e => (e.target.style.borderColor = 'rgba(59,130,246,0.4)')}
                    onBlur={e => (e.target.style.borderColor = 'rgba(255,255,255,0.08)')}
                  />
                </div>
              ))}
            </div>

            {/* Pieces row */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, animation: 'fadeUp 0.4s ease 0.2s both' }}>
              {[
                { label: 'Pieces on Bill', key: 'pieces_billed', placeholder: '600' },
                { label: 'Pieces Actually Counted', key: 'pieces_received', placeholder: '600' },
              ].map(({ label, key, placeholder }) => (
                <div key={key}>
                  <label style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', marginBottom: 8, fontFamily: "'JetBrains Mono',monospace" }}>
                    {label}
                  </label>
                  <input type="number" min="0" value={form[key as keyof typeof form]}
                    onChange={e => set(key, e.target.value)}
                    placeholder={placeholder} required
                    style={{ width: '100%', background: 'rgba(255,255,255,0.03)', border: `1px solid ${key === 'pieces_received' && hasShortfall ? 'rgba(239,68,68,0.4)' : 'rgba(255,255,255,0.08)'}`, borderRadius: 10, padding: '12px 14px', color: '#fff', fontSize: 14, outline: 'none' }}
                    onFocus={e => (e.target.style.borderColor = 'rgba(59,130,246,0.4)')}
                    onBlur={e => (e.target.style.borderColor = key === 'pieces_received' && hasShortfall ? 'rgba(239,68,68,0.4)' : 'rgba(255,255,255,0.08)')}
                  />
                </div>
              ))}
            </div>

            {/* Shortfall warning */}
            {hasShortfall && (
              <div style={{ padding: '12px 14px', borderRadius: 10, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 18 }}>⚠️</span>
                <div>
                  <p style={{ fontSize: 13, fontWeight: 600, color: '#ef4444' }}>Supplier Shortfall Detected</p>
                  <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>
                    {Number(form.pieces_billed) - Number(form.pieces_received)} pieces missing from bill.
                    This will be flagged as a supplier discrepancy.
                  </p>
                </div>
              </div>
            )}

            {/* Notes */}
            <div style={{ animation: 'fadeUp 0.4s ease 0.25s both' }}>
              <label style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', marginBottom: 8, fontFamily: "'JetBrains Mono',monospace" }}>
                Notes (optional)
              </label>
              <textarea value={form.notes} onChange={e => set('notes', e.target.value)}
                placeholder="Any observations about this delivery..."
                rows={2}
                style={{ width: '100%', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, padding: '12px 14px', color: '#fff', fontSize: 14, outline: 'none', resize: 'none', fontFamily: 'inherit' }}
                onFocus={e => (e.target.style.borderColor = 'rgba(59,130,246,0.4)')}
                onBlur={e => (e.target.style.borderColor = 'rgba(255,255,255,0.08)')}
              />
            </div>

            {error && (
              <div style={{ padding: '12px 14px', borderRadius: 10, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#ef4444', fontSize: 13 }}>
                {error}
              </div>
            )}

            <button type="submit" disabled={submitting}
              style={{ padding: '14px', borderRadius: 12, background: submitting ? 'rgba(59,130,246,0.4)' : 'linear-gradient(135deg,#3b82f6,#1d4ed8)', border: 'none', color: '#fff', fontSize: 14, fontWeight: 700, cursor: submitting ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, boxShadow: submitting ? 'none' : '0 4px 24px rgba(59,130,246,0.3)', letterSpacing: '-0.3px' }}>
              {submitting ? (
                <>
                  <div style={{ width: 16, height: 16, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                  Saving delivery...
                </>
              ) : '📦 Confirm Delivery & Generate QR Codes →'}
            </button>
          </form>

          {/* RIGHT PANEL — Summary */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

            {/* Live summary */}
            <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 14, padding: '18px', position: 'sticky', top: 72 }}>
              <h3 style={{ fontSize: 13, fontWeight: 700, marginBottom: 16, color: 'rgba(255,255,255,0.6)' }}>
                Delivery Summary
              </h3>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {[
                  { label: 'Supplier',       value: selectedSupplier?.name || '—' },
                  { label: 'Product',        value: selectedProduct?.name  || '—' },
                  { label: 'Sets Billed',    value: form.sets_billed       || '—' },
                  { label: 'Sets Received',  value: form.sets_received     || '—' },
                  { label: 'Pieces Billed',  value: form.pieces_billed     || '—' },
                  { label: 'Pieces Counted', value: form.pieces_received   || '—' },
                ].map(({ label, value }) => (
                  <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                    <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)' }}>{label}</span>
                    <span style={{ fontSize: 12, fontWeight: 600, color: '#fff', fontFamily: "'JetBrains Mono',monospace" }}>{value}</span>
                  </div>
                ))}

                {/* QR codes that will be generated */}
                {form.sets_received && Number(form.sets_received) > 0 && (
                  <div style={{ marginTop: 8, padding: '12px', borderRadius: 10, background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.15)' }}>
                    <p style={{ fontSize: 11, color: '#3b82f6', fontWeight: 600 }}>
                      ⚡ {form.sets_received} QR codes will be generated
                    </p>
                    <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.25)', marginTop: 4 }}>
                      Each set gets a unique scannable QR code
                    </p>
                  </div>
                )}

                {hasShortfall && (
                  <div style={{ padding: '12px', borderRadius: 10, background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.15)' }}>
                    <p style={{ fontSize: 11, color: '#ef4444', fontWeight: 600 }}>
                      ⚠ Discrepancy will be auto-flagged
                    </p>
                    <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.25)', marginTop: 4 }}>
                      Owner will see alert on dashboard
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* How it works */}
            <div style={{ background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.04)', borderRadius: 14, padding: '16px' }}>
              <h3 style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 12, fontFamily: "'JetBrains Mono',monospace" }}>
                What happens next
              </h3>
              {[
                { icon: '📦', text: 'Delivery saved to database' },
                { icon: '🏷️', text: 'QR code generated per set' },
                { icon: '📋', text: 'Chain of custody started' },
                { icon: '⚠️', text: 'Shortfalls auto-flagged' },
              ].map(({ icon, text }) => (
                <div key={text} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0' }}>
                  <span style={{ fontSize: 14 }}>{icon}</span>
                  <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)' }}>{text}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}