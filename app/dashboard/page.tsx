'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

const supabase = createClient()

// ── tiny helpers ──────────────────────────────────────────────
function Spinner({ color = '#f97316' }: { color?: string }) {
  return (
    <>
      <div style={{
        width: 32, height: 32,
        border: `2px solid ${color}22`,
        borderTopColor: color,
        borderRadius: '50%',
        animation: 'spin 0.8s linear infinite',
      }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </>
  )
}

function Ring({ pct, color, size = 80 }: { pct: number; color: string; size?: number }) {
  const r = (size - 10) / 2
  const circ = 2 * Math.PI * r
  return (
    <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none"
        stroke="rgba(255,255,255,0.05)" strokeWidth={6} />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none"
        stroke={color} strokeWidth={6}
        strokeDasharray={circ}
        strokeDashoffset={circ * (1 - pct / 100)}
        strokeLinecap="round"
        style={{ transition: 'stroke-dashoffset 1s ease' }}
      />
    </svg>
  )
}

function Bar({ pct, color }: { pct: number; color: string }) {
  return (
    <div style={{ height: 4, background: 'rgba(255,255,255,0.06)', borderRadius: 99, overflow: 'hidden' }}>
      <div style={{
        height: '100%', width: `${pct}%`, background: color,
        borderRadius: 99, transition: 'width 1s ease',
        boxShadow: `0 0 8px ${color}88`,
      }} />
    </div>
  )
}

// ── stage chip ────────────────────────────────────────────────
const STAGE: Record<string, { emoji: string; bg: string; border: string; label: string }> = {
  outward:  { emoji: '🚫', bg: 'rgba(239,68,68,0.1)',   border: 'rgba(239,68,68,0.25)',   label: 'Outward' },
  inward:   { emoji: '📦', bg: 'rgba(59,130,246,0.1)',  border: 'rgba(59,130,246,0.25)',  label: 'Inward'  },
  storage:  { emoji: '🏭', bg: 'rgba(245,158,11,0.1)',  border: 'rgba(245,158,11,0.25)',  label: 'Storage' },
}

export default function OwnerDashboard() {
  const router = useRouter()
  const [staff, setStaff]               = useState<any>(null)
  const [locations, setLocations]       = useState<any[]>([])
  const [discrepancies, setDisc]        = useState<any[]>([])
  const [offenders, setOffenders]       = useState<any[]>([])
  const [stats, setStats]               = useState({ inward:0, outward:0, alerts:0, blocked:0, sets:0, shrinkage:0 })
  const [aiData, setAiData]             = useState<any>(null)
  const [aiLoading, setAiLoading]       = useState(false)
  const [loading, setLoading]           = useState(true)
  const [loc, setLoc]                   = useState('all')
  const [tab, setTab]                   = useState<'feed'|'chain'>('feed')
  const [tick, setTick]                 = useState(0)          // live clock
  const timerRef                        = useRef<any>(null)

  // live clock
  useEffect(() => {
    timerRef.current = setInterval(() => setTick(t => t + 1), 30000)
    return () => clearInterval(timerRef.current)
  }, [])

  useEffect(() => { loadAll() }, [])

  async function loadAll() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }

    const [{ data: s }, { data: locs }, { data: disc }, { data: allSets }, { data: dispatched }, { data: inward }] =
      await Promise.all([
        supabase.from('staff').select('*, location:locations(*)').eq('id', user.id).single(),
        supabase.from('locations').select('*'),
        supabase.from('discrepancies')
          .select('*, staff:reported_by(name,shift,email), location:locations(name)')
          .order('created_at', { ascending: false }).limit(20),
        supabase.from('sets').select('*'),
        supabase.from('access_logs').select('*').eq('action','dispatched')
          .gte('created_at', new Date(Date.now()-86400000).toISOString()),
        supabase.from('inward_batches').select('*')
          .gte('created_at', new Date(Date.now()-86400000).toISOString()),
      ])

    setStaff(s); setLocations(locs || [])

    const open   = (disc||[]).filter((d:any) => d.status==='open')
    const blocked= (disc||[]).filter((d:any) => d.stage==='outward' && d.status==='open')
    const pb     = (inward||[]).reduce((a:number,b:any)=>a+b.pieces_billed,0)
    const pr     = (inward||[]).reduce((a:number,b:any)=>a+b.pieces_received,0)

    setStats({
      inward:   inward?.length||0,
      outward:  dispatched?.length||0,
      alerts:   open.length,
      blocked:  blocked.length,
      sets:     allSets?.length||0,
      shrinkage:pb>0?+((pb-pr)/pb*100).toFixed(1):0,
    })
    setDisc(disc||[])

    // offender map
    const map: Record<string,any> = {}
    ;(disc||[]).forEach((d:any) => {
      if(d.status==='resolved') return
      const n = d.staff?.name||'Unknown'
      if(!map[n]) map[n]={ name:n, shift:d.staff?.shift, count:0, delta:0 }
      map[n].count++; map[n].delta += Math.abs(d.delta)
    })
    setOffenders(Object.values(map).sort((a,b)=>b.count-a.count).slice(0,4))
    setLoading(false)
  }

  async function runAI() {
    setAiLoading(true)
    try {
      const r = await fetch('/api/ai/patterns',{ method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({days:30}) })
      setAiData(await r.json())
    } catch { setAiData({ error: true }) }
    setAiLoading(false)
  }

  if (loading) return (
    <div style={{ minHeight:'100vh', background:'#060608', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:16 }}>
      <Spinner /><span style={{ color:'rgba(255,255,255,0.2)', fontSize:13 }}>Loading intelligence…</span>
    </div>
  )

  const openDisc   = discrepancies.filter(d=>d.status==='open')
  const filteredDisc = loc==='all' ? discrepancies : discrepancies.filter(d=>d.location_id===loc)
  const riskColor  = stats.shrinkage>5?'#ef4444':stats.shrinkage>2?'#f59e0b':'#22c55e'
  const riskLabel  = stats.shrinkage>5?'CRITICAL':stats.shrinkage>2?'ELEVATED':'HEALTHY'
  const resolvedPct= discrepancies.length>0
    ? Math.round(discrepancies.filter(d=>d.status==='resolved').length/discrepancies.length*100) : 100

  return (
    <div style={{ minHeight:'100vh', background:'#060608', color:'#fff',
      fontFamily:"'DM Sans',system-ui,sans-serif", overflowX:'hidden' }}>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800;900&family=JetBrains+Mono:wght@400;600&display=swap');
        *{box-sizing:border-box;margin:0;padding:0}
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes fadeUp{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}
        @keyframes glow{0%,100%{opacity:.6}50%{opacity:1}}
        @keyframes scanline{0%{top:-10%}100%{top:110%}}
        ::-webkit-scrollbar{width:3px}
        ::-webkit-scrollbar-thumb{background:rgba(255,255,255,0.08);border-radius:99px}
      `}</style>

      {/* ── AMBIENT BACKGROUND ── */}
      <div style={{ position:'fixed', inset:0, pointerEvents:'none', zIndex:0 }}>
        <div style={{ position:'absolute', top:'-20%', left:'-10%', width:700, height:700,
          background:'radial-gradient(circle, rgba(249,115,22,0.07) 0%, transparent 65%)',
          borderRadius:'50%' }} />
        <div style={{ position:'absolute', bottom:'-20%', right:'-5%', width:500, height:500,
          background:'radial-gradient(circle, rgba(59,130,246,0.05) 0%, transparent 65%)',
          borderRadius:'50%' }} />
        {/* subtle grid */}
        <div style={{ position:'absolute', inset:0,
          backgroundImage:'linear-gradient(rgba(255,255,255,0.015) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.015) 1px,transparent 1px)',
          backgroundSize:'48px 48px' }} />
      </div>

      {/* ── TOPNAV ── */}
      <nav style={{ position:'sticky', top:0, zIndex:100,
        background:'rgba(6,6,8,0.85)', backdropFilter:'blur(20px)',
        borderBottom:'1px solid rgba(255,255,255,0.05)',
        display:'flex', alignItems:'center', justifyContent:'space-between',
        padding:'0 28px', height:56 }}>

        {/* brand */}
        <div style={{ display:'flex', alignItems:'center', gap:20 }}>
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:2.5, width:22, height:22 }}>
              {[.95,.25,.25,.95].map((o,i)=>(
                <div key={i} style={{ background:`rgba(249,115,22,${o})`, borderRadius:3 }} />
              ))}
            </div>
            <span style={{ fontWeight:800, fontSize:16, color:'#f97316', letterSpacing:'-0.5px' }}>BrokenSet</span>
          </div>

          {/* nav tabs */}
          <div style={{ display:'flex', gap:2 }}>
            {['Overview','Discrepancies','Staff','Patterns'].map((item,i)=>(
              <button key={item} style={{
                padding:'5px 14px', borderRadius:7, fontSize:12, fontWeight:500,
                background: i===0?'rgba(249,115,22,0.12)':'transparent',
                border: i===0?'1px solid rgba(249,115,22,0.2)':'1px solid transparent',
                color: i===0?'#f97316':'rgba(255,255,255,0.35)',
                cursor:'pointer', transition:'all 0.15s',
              }}>{item}</button>
            ))}
          </div>
        </div>

        {/* right */}
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          {/* live pill */}
          <div style={{ display:'flex', alignItems:'center', gap:6,
            padding:'4px 10px', borderRadius:99,
            background:'rgba(34,197,94,0.08)', border:'1px solid rgba(34,197,94,0.15)' }}>
            <div style={{ width:5, height:5, borderRadius:'50%', background:'#22c55e',
              boxShadow:'0 0 6px #22c55e', animation:'glow 2s ease-in-out infinite' }} />
            <span style={{ fontSize:11, color:'#22c55e', fontWeight:600 }}>LIVE</span>
          </div>

          {/* location */}
          <select value={loc} onChange={e=>setLoc(e.target.value)} style={{
            background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.08)',
            borderRadius:8, padding:'5px 10px', color:'rgba(255,255,255,0.7)',
            fontSize:12, outline:'none', cursor:'pointer' }}>
            <option value="all">All Locations</option>
            {locations.map(l=><option key={l.id} value={l.id}>{l.name}</option>)}
          </select>

          {/* avatar */}
          <div style={{ display:'flex', alignItems:'center', gap:8,
            padding:'5px 10px', borderRadius:8,
            background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.06)' }}>
            <div style={{ width:22, height:22, borderRadius:'50%',
              background:'linear-gradient(135deg,#f97316,#dc2626)',
              display:'flex', alignItems:'center', justifyContent:'center',
              fontSize:10, fontWeight:800 }}>
              {staff?.name?.[0]||'O'}
            </div>
            <span style={{ fontSize:12, color:'rgba(255,255,255,0.55)' }}>{staff?.name}</span>
          </div>

          <button onClick={async()=>{ await supabase.auth.signOut(); router.push('/login') }}
            style={{ background:'transparent', border:'1px solid rgba(255,255,255,0.07)',
              borderRadius:7, padding:'5px 12px', color:'rgba(255,255,255,0.25)',
              fontSize:12, cursor:'pointer' }}>
            Logout
          </button>
        </div>
      </nav>

      {/* ── BODY ── */}
      <div style={{ position:'relative', zIndex:1, padding:'28px 28px 48px', maxWidth:1440, margin:'0 auto' }}>

        {/* ── PAGE HEADER ── */}
        <div style={{ display:'flex', alignItems:'flex-end', justifyContent:'space-between', marginBottom:28, animation:'fadeUp 0.4s ease' }}>
          <div>
            <p style={{ fontSize:11, color:'rgba(255,255,255,0.25)', fontFamily:"'JetBrains Mono',monospace", marginBottom:6 }}>
              {new Date().toLocaleDateString('en-IN',{weekday:'long',year:'numeric',month:'long',day:'numeric'})}
            </p>
            <h1 style={{ fontSize:32, fontWeight:900, letterSpacing:'-1.5px', lineHeight:1 }}>
              Inventory <span style={{ color:'#f97316' }}>Intelligence</span>
            </h1>
            <p style={{ color:'rgba(255,255,255,0.28)', fontSize:13, marginTop:6 }}>
              Every piece tracked · Every checkpoint enforced · Zero invisible loss
            </p>
          </div>

          {/* Shrinkage ring hero */}
          <div style={{ display:'flex', alignItems:'center', gap:16,
            padding:'16px 24px', borderRadius:16,
            background:'rgba(255,255,255,0.02)', border:`1px solid ${riskColor}22` }}>
            <div style={{ position:'relative', width:80, height:80 }}>
              <Ring pct={100-Math.min(stats.shrinkage*10,100)} color={riskColor} size={80} />
              <div style={{ position:'absolute', inset:0, display:'flex', alignItems:'center',
                justifyContent:'center', flexDirection:'column' }}>
                <span style={{ fontSize:15, fontWeight:800, color:riskColor, lineHeight:1 }}>
                  {stats.shrinkage}%
                </span>
              </div>
            </div>
            <div>
              <p style={{ fontSize:10, color:'rgba(255,255,255,0.3)', fontFamily:"'JetBrains Mono',monospace" }}>SHRINKAGE RATE</p>
              <p style={{ fontSize:18, fontWeight:800, color:riskColor, letterSpacing:'-0.5px' }}>{riskLabel}</p>
              <p style={{ fontSize:11, color:'rgba(255,255,255,0.25)', marginTop:2 }}>
                {resolvedPct}% discrepancies resolved
              </p>
            </div>
          </div>
        </div>

        {/* ── STAT CARDS ── */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(5,1fr)', gap:12, marginBottom:20 }}>
          {[
            { label:'Inward Today',     value:stats.inward,   suffix:'', color:'#3b82f6', icon:'↓', sub:'batches received' },
            { label:'Dispatched',       value:stats.outward,  suffix:'', color:'#22c55e', icon:'↑', sub:'sets shipped' },
            { label:'Open Alerts',      value:stats.alerts,   suffix:'', color:'#f59e0b', icon:'!', sub:'need action' },
            { label:'Dispatch Blocked', value:stats.blocked,  suffix:'', color:'#ef4444', icon:'✕', sub:'broken sets caught' },
            { label:'Total Sets',       value:stats.sets,     suffix:'', color:'#a855f7', icon:'◼', sub:'in system' },
          ].map(({ label, value, suffix, color, icon, sub }, idx) => (
            <div key={label} style={{
              background:'rgba(255,255,255,0.02)',
              border:'1px solid rgba(255,255,255,0.05)',
              borderRadius:14, padding:'18px 18px 14px',
              position:'relative', overflow:'hidden',
              animation:`fadeUp 0.4s ease ${idx*0.06}s both`,
              cursor:'default', transition:'border-color 0.2s, transform 0.2s',
            }}
              onMouseEnter={e=>{
                e.currentTarget.style.borderColor=`${color}44`
                e.currentTarget.style.transform='translateY(-2px)'
              }}
              onMouseLeave={e=>{
                e.currentTarget.style.borderColor='rgba(255,255,255,0.05)'
                e.currentTarget.style.transform='translateY(0)'
              }}
            >
              {/* glow accent top-right */}
              <div style={{ position:'absolute', top:-20, right:-20, width:80, height:80,
                background:`radial-gradient(circle, ${color}20 0%, transparent 70%)`,
                borderRadius:'50%', pointerEvents:'none' }} />

              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:14 }}>
                <span style={{ fontSize:11, color:'rgba(255,255,255,0.3)', fontWeight:500 }}>{label}</span>
                <div style={{ width:26, height:26, borderRadius:6,
                  background:`${color}18`, border:`1px solid ${color}30`,
                  display:'flex', alignItems:'center', justifyContent:'center',
                  fontSize:12, color, fontWeight:700 }}>
                  {icon}
                </div>
              </div>

              <div style={{ fontSize:36, fontWeight:900, letterSpacing:'-2px',
                color:'#fff', lineHeight:1, marginBottom:8 }}>
                {value}{suffix}
              </div>

              <Bar pct={Math.min(value*10||5, 100)} color={color} />

              <div style={{ fontSize:10, color:'rgba(255,255,255,0.2)', marginTop:6 }}>{sub}</div>
            </div>
          ))}
        </div>

        {/* ── MAIN GRID ── */}
        <div style={{ display:'grid', gridTemplateColumns:'1fr 360px', gap:16 }}>

          {/* ── LEFT: FEED ── */}
          <div style={{ display:'flex', flexDirection:'column', gap:16 }}>

            {/* feed card */}
            <div style={{ background:'rgba(255,255,255,0.02)',
              border:'1px solid rgba(255,255,255,0.05)', borderRadius:16,
              overflow:'hidden', animation:'fadeUp 0.5s ease 0.2s both' }}>

              {/* card header */}
              <div style={{ padding:'18px 22px', borderBottom:'1px solid rgba(255,255,255,0.04)',
                display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                <div style={{ display:'flex', flexDirection:'column', gap:2 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                    <h2 style={{ fontSize:14, fontWeight:700 }}>Discrepancy Intelligence Feed</h2>
                    {openDisc.length>0&&(
                      <div style={{ padding:'2px 8px', borderRadius:99, fontSize:10, fontWeight:700,
                        background:'rgba(239,68,68,0.12)', border:'1px solid rgba(239,68,68,0.25)',
                        color:'#ef4444', animation:'glow 2s ease infinite' }}>
                        {openDisc.length} LIVE
                      </div>
                    )}
                  </div>
                  <p style={{ fontSize:11, color:'rgba(255,255,255,0.25)' }}>
                    Real-time alerts from all 4 control points
                  </p>
                </div>

                {/* tab switcher */}
                <div style={{ display:'flex', gap:4, background:'rgba(255,255,255,0.04)',
                  border:'1px solid rgba(255,255,255,0.06)', borderRadius:8, padding:3 }}>
                  {(['feed','chain'] as const).map(t=>(
                    <button key={t} onClick={()=>setTab(t)} style={{
                      padding:'4px 12px', borderRadius:6, fontSize:11, fontWeight:600,
                      background: tab===t?'rgba(255,255,255,0.08)':'transparent',
                      border: 'none',
                      color: tab===t?'#fff':'rgba(255,255,255,0.3)',
                      cursor:'pointer', transition:'all 0.15s', textTransform:'capitalize',
                    }}>{t==='feed'?'Live Feed':'Chain'}</button>
                  ))}
                </div>
              </div>

              {/* feed items */}
              <div style={{ maxHeight:400, overflowY:'auto' }}>
                {(loc==='all'?discrepancies:filteredDisc).length===0?(
                  <div style={{ padding:48, textAlign:'center', color:'rgba(255,255,255,0.15)' }}>
                    <div style={{ fontSize:40, marginBottom:8 }}>✓</div>
                    <div style={{ fontSize:13 }}>All clear — no discrepancies logged</div>
                  </div>
                ):(loc==='all'?discrepancies:filteredDisc).map((d:any, i:number)=>{
                  const s = STAGE[d.stage]||STAGE.storage
                  const isOpen = d.status==='open'
                  return (
                    <div key={d.id} style={{
                      padding:'14px 22px',
                      borderBottom:'1px solid rgba(255,255,255,0.03)',
                      display:'flex', alignItems:'center', gap:12,
                      animation:`fadeUp 0.3s ease ${i*0.04}s both`,
                      transition:'background 0.15s',
                      borderLeft: isOpen?`2px solid rgba(239,68,68,0.4)`:'2px solid transparent',
                    }}
                      onMouseEnter={e=>(e.currentTarget.style.background='rgba(255,255,255,0.015)')}
                      onMouseLeave={e=>(e.currentTarget.style.background='transparent')}
                    >
                      {/* stage icon */}
                      <div style={{ width:38, height:38, borderRadius:10, flexShrink:0,
                        background:s.bg, border:`1px solid ${s.border}`,
                        display:'flex', alignItems:'center', justifyContent:'center', fontSize:16 }}>
                        {s.emoji}
                      </div>

                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:3, flexWrap:'wrap' }}>
                          <span style={{ fontSize:13, fontWeight:700 }}>
                            {d.staff?.name||'Unknown'}
                          </span>
                          {/* chips */}
                          {[
                            { label:s.label, bg:'rgba(255,255,255,0.06)', color:'rgba(255,255,255,0.4)' },
                            d.staff?.shift&&{ label:d.staff.shift+' shift', bg:'rgba(168,85,247,0.1)', color:'#a855f7' },
                            { label:d.status, bg: isOpen?'rgba(239,68,68,0.1)':'rgba(34,197,94,0.1)',
                              color: isOpen?'#ef4444':'#22c55e' },
                          ].filter(Boolean).map((chip:any)=>(
                            <span key={chip.label} style={{ fontSize:9, padding:'2px 6px', borderRadius:4,
                              background:chip.bg, color:chip.color, textTransform:'uppercase',
                              fontFamily:"'JetBrains Mono',monospace", fontWeight:600 }}>
                              {chip.label}
                            </span>
                          ))}
                        </div>
                        <div style={{ fontSize:11, color:'rgba(255,255,255,0.3)' }}>
                          {d.location?.name||'Unknown'} ·{' '}
                          {Math.abs(d.delta)} piece{Math.abs(d.delta)!==1?'s':''} missing ·{' '}
                          {new Date(d.created_at).toLocaleString('en-IN',{
                            hour:'2-digit', minute:'2-digit',
                            day:'numeric', month:'short',
                          })}
                        </div>
                      </div>

                      {/* delta badge */}
                      <div style={{ fontFamily:"'JetBrains Mono',monospace",
                        fontSize:20, fontWeight:700,
                        color: isOpen?'#ef4444':'rgba(255,255,255,0.2)',
                        letterSpacing:'-1px', flexShrink:0 }}>
                        -{Math.abs(d.delta)}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* ── CHECKPOINT HEALTH ROW ── */}
            <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:12 }}>
              {[
                { label:'Inward Control',  icon:'📦', stage:'inward',  color:'#3b82f6' },
                { label:'Storage Control', icon:'🏭', stage:'storage', color:'#f59e0b' },
                { label:'Outward Control', icon:'🚚', stage:'outward', color:'#ef4444' },
              ].map(({ label, icon, stage, color })=>{
                const total  = discrepancies.filter(d=>d.stage===stage).length
                const open   = discrepancies.filter(d=>d.stage===stage&&d.status==='open').length
                const health = total===0?100:Math.round((1-open/total)*100)
                return (
                  <div key={stage} style={{ background:'rgba(255,255,255,0.02)',
                    border:'1px solid rgba(255,255,255,0.05)', borderRadius:14,
                    padding:'16px', animation:'fadeUp 0.5s ease 0.35s both' }}>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
                      <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                        <span style={{ fontSize:18 }}>{icon}</span>
                        <span style={{ fontSize:12, fontWeight:600, color:'rgba(255,255,255,0.7)' }}>{label}</span>
                      </div>
                      <span style={{ fontFamily:"'JetBrains Mono',monospace",
                        fontSize:13, fontWeight:700, color }}>
                        {health}%
                      </span>
                    </div>
                    <Bar pct={health} color={color} />
                    <p style={{ fontSize:10, color:'rgba(255,255,255,0.2)', marginTop:8 }}>
                      {open} open · {total} total
                    </p>
                  </div>
                )
              })}
            </div>
          </div>

          {/* ── RIGHT COLUMN ── */}
          <div style={{ display:'flex', flexDirection:'column', gap:16 }}>

            {/* ── STAFF RISK BOARD ── */}
            <div style={{ background:'rgba(255,255,255,0.02)',
              border:'1px solid rgba(255,255,255,0.05)', borderRadius:16,
              padding:'18px', animation:'fadeUp 0.5s ease 0.25s both' }}>

              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:4 }}>
                <h3 style={{ fontSize:14, fontWeight:700 }}>Staff Risk Board</h3>
                <span style={{ fontSize:10, color:'rgba(255,255,255,0.2)',
                  fontFamily:"'JetBrains Mono',monospace" }}>LIVE</span>
              </div>
              <p style={{ fontSize:11, color:'rgba(255,255,255,0.25)', marginBottom:16 }}>
                Ranked by discrepancy correlation
              </p>

              {offenders.length===0?(
                <div style={{ textAlign:'center', padding:'20px 0',
                  color:'rgba(255,255,255,0.15)', fontSize:12 }}>
                  No flagged staff
                </div>
              ):offenders.map((o,i)=>{
                const riskColors = ['#ef4444','#f59e0b','#3b82f6','rgba(255,255,255,0.3)']
                const riskLabels = ['HIGH RISK','MEDIUM','WATCH','LOW']
                const c = riskColors[i]||riskColors[3]
                const maxCount = offenders[0].count||1
                return (
                  <div key={o.name} style={{
                    padding:'12px 0',
                    borderBottom: i<offenders.length-1?'1px solid rgba(255,255,255,0.04)':'none',
                  }}>
                    <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:8 }}>
                      <div style={{ width:32, height:32, borderRadius:8,
                        background:`${c}18`, border:`1px solid ${c}30`,
                        display:'flex', alignItems:'center', justifyContent:'center',
                        fontSize:13, fontWeight:800, color:c, flexShrink:0 }}>
                        {o.name[0]}
                      </div>
                      <div style={{ flex:1 }}>
                        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                          <span style={{ fontSize:13, fontWeight:600 }}>{o.name}</span>
                          <span style={{ fontSize:9, fontFamily:"'JetBrains Mono',monospace",
                            fontWeight:700, color:c }}>{riskLabels[i]||'LOW'}</span>
                        </div>
                        <div style={{ fontSize:10, color:'rgba(255,255,255,0.25)', marginTop:1, textTransform:'capitalize' }}>
                          {o.shift||'unknown'} shift · {o.count} flags · {o.delta} pieces missing
                        </div>
                      </div>
                    </div>
                    <Bar pct={Math.round(o.count/maxCount*100)} color={c} />
                  </div>
                )
              })}
            </div>

            {/* ── AI PATTERN ENGINE ── */}
            <div style={{ background:'rgba(255,255,255,0.02)',
              border: aiData?'1px solid rgba(168,85,247,0.25)':'1px solid rgba(255,255,255,0.05)',
              borderRadius:16, padding:'18px',
              animation:'fadeUp 0.5s ease 0.3s both',
              transition:'border-color 0.4s' }}>

              <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:4 }}>
                <div style={{ width:24, height:24, borderRadius:6,
                  background:'rgba(168,85,247,0.12)', border:'1px solid rgba(168,85,247,0.25)',
                  display:'flex', alignItems:'center', justifyContent:'center', fontSize:12 }}>⚡</div>
                <h3 style={{ fontSize:14, fontWeight:700 }}>AI Theft Pattern Engine</h3>
              </div>
              <p style={{ fontSize:11, color:'rgba(255,255,255,0.25)', marginBottom:16 }}>
                Claude AI detects systematic theft patterns
              </p>

              {!aiData&&!aiLoading&&(
                <button onClick={runAI} style={{
                  width:'100%', padding:'13px',
                  background:'linear-gradient(135deg,rgba(168,85,247,0.15),rgba(168,85,247,0.05))',
                  border:'1px solid rgba(168,85,247,0.25)', borderRadius:10,
                  color:'#a855f7', fontSize:13, fontWeight:700,
                  cursor:'pointer', transition:'all 0.15s', letterSpacing:'-0.3px',
                }}
                  onMouseEnter={e=>(e.currentTarget.style.background='linear-gradient(135deg,rgba(168,85,247,0.25),rgba(168,85,247,0.1))')}
                  onMouseLeave={e=>(e.currentTarget.style.background='linear-gradient(135deg,rgba(168,85,247,0.15),rgba(168,85,247,0.05))')}
                >
                  ⚡ Run Pattern Analysis
                </button>
              )}

              {aiLoading&&(
                <div style={{ display:'flex', flexDirection:'column', alignItems:'center', padding:'24px 0', gap:10 }}>
                  <Spinner color="#a855f7" />
                  <span style={{ fontSize:12, color:'rgba(255,255,255,0.3)' }}>
                    Analyzing 30 days of patterns…
                  </span>
                </div>
              )}

              {aiData&&!aiData.error&&(
                <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                  {/* risk pill */}
                  <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between',
                    padding:'10px 14px', borderRadius:10,
                    background: aiData.risk_level==='critical'?'rgba(239,68,68,0.08)':
                      aiData.risk_level==='high'?'rgba(245,158,11,0.08)':'rgba(34,197,94,0.08)',
                    border:`1px solid ${aiData.risk_level==='critical'?'rgba(239,68,68,0.2)':
                      aiData.risk_level==='high'?'rgba(245,158,11,0.2)':'rgba(34,197,94,0.2)'}` }}>
                    <span style={{ fontSize:11, color:'rgba(255,255,255,0.4)' }}>Overall Risk</span>
                    <span style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:12, fontWeight:700,
                      textTransform:'uppercase',
                      color: aiData.risk_level==='critical'?'#ef4444':
                        aiData.risk_level==='high'?'#f59e0b':'#22c55e' }}>
                      {aiData.risk_level}
                    </span>
                  </div>

                  {/* suspect */}
                  <div style={{ padding:'10px 14px', borderRadius:10,
                    background:'rgba(249,115,22,0.06)', border:'1px solid rgba(249,115,22,0.15)' }}>
                    <div style={{ fontSize:9, color:'rgba(255,255,255,0.3)',
                      fontFamily:"'JetBrains Mono',monospace", marginBottom:4 }}>TOP RISK PROFILE</div>
                    <div style={{ fontSize:14, fontWeight:700, color:'#f97316' }}>
                      {aiData.top_suspect}
                    </div>
                  </div>

                  {/* summary */}
                  <p style={{ fontSize:11, color:'rgba(255,255,255,0.35)', lineHeight:1.7 }}>
                    {aiData.pattern_summary}
                  </p>

                  {/* recommendations */}
                  {aiData.recommendations?.slice(0,3).map((r:string,i:number)=>(
                    <div key={i} style={{ fontSize:11, color:'rgba(255,255,255,0.35)',
                      padding:'8px 12px', borderRadius:8,
                      background:'rgba(255,255,255,0.02)',
                      borderLeft:'2px solid rgba(168,85,247,0.4)', lineHeight:1.5 }}>
                      {r}
                    </div>
                  ))}

                  {/* confidence */}
                  <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                    <span style={{ fontSize:10, color:'rgba(255,255,255,0.2)' }}>
                      Confidence: {aiData.confidence}%
                    </span>
                    <button onClick={runAI} style={{ background:'transparent',
                      border:'1px solid rgba(255,255,255,0.06)', borderRadius:6,
                      padding:'4px 10px', color:'rgba(255,255,255,0.25)',
                      fontSize:10, cursor:'pointer' }}>
                      Re-run
                    </button>
                  </div>
                </div>
              )}

              {aiData?.error&&(
                <div style={{ fontSize:12, color:'#ef4444', padding:'8px 12px',
                  background:'rgba(239,68,68,0.08)', borderRadius:8, border:'1px solid rgba(239,68,68,0.2)' }}>
                  Analysis failed. Check your API key and try again.
                </div>
              )}
            </div>

            {/* ── QUICK ACTIONS ── */}
            <div style={{ background:'rgba(255,255,255,0.02)',
              border:'1px solid rgba(255,255,255,0.05)', borderRadius:16,
              padding:'18px', animation:'fadeUp 0.5s ease 0.35s both' }}>
              <h3 style={{ fontSize:14, fontWeight:700, marginBottom:12 }}>Quick Actions</h3>
              <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                {[
                  { label:'All Discrepancies', sub:'View & manage alerts', color:'#ef4444', path:'/dashboard/discrepancies' },
                  { label:'Staff Report',       sub:'Risk rankings',        color:'#f59e0b', path:'/dashboard/staff' },
                  { label:'Location Compare',   sub:'Cross-warehouse view', color:'#3b82f6', path:'/dashboard/locations' },
                ].map(({ label, sub, color, path })=>(
                  <button key={label} onClick={()=>router.push(path)} style={{
                    display:'flex', alignItems:'center', justifyContent:'space-between',
                    padding:'10px 12px', borderRadius:10,
                    background:'rgba(255,255,255,0.02)', border:'1px solid rgba(255,255,255,0.05)',
                    cursor:'pointer', transition:'all 0.15s', textAlign:'left',
                  }}
                    onMouseEnter={e=>{
                      e.currentTarget.style.borderColor=`${color}35`
                      e.currentTarget.style.background=`${color}08`
                    }}
                    onMouseLeave={e=>{
                      e.currentTarget.style.borderColor='rgba(255,255,255,0.05)'
                      e.currentTarget.style.background='rgba(255,255,255,0.02)'
                    }}
                  >
                    <div>
                      <div style={{ fontSize:12, fontWeight:600, color:'rgba(255,255,255,0.7)' }}>{label}</div>
                      <div style={{ fontSize:10, color:'rgba(255,255,255,0.25)', marginTop:1 }}>{sub}</div>
                    </div>
                    <span style={{ color, fontSize:16 }}>→</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}