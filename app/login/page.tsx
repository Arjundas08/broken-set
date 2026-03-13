'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

const ROLES = [
  {
    role: 'Owner',
    email: 'owner@brokenset.com',
    password: 'Owner@123',
    icon: '◆',
    color: '#f97316',
    bg: 'rgba(249,115,22,0.08)',
    border: 'rgba(249,115,22,0.2)',
    desc: 'Full visibility across all locations'
  },
  {
    role: 'Supervisor',
    email: 'supervisor@brokenset.com',
    password: 'Supervisor@123',
    icon: '▲',
    color: '#3b82f6',
    bg: 'rgba(59,130,246,0.08)',
    border: 'rgba(59,130,246,0.2)',
    desc: 'Manage inward stock & storage floor'
  },
  {
    role: 'Packer',
    email: 'packer@brokenset.com',
    password: 'Packer@123',
    icon: '●',
    color: '#22c55e',
    bg: 'rgba(34,197,94,0.08)',
    border: 'rgba(34,197,94,0.2)',
    desc: 'Scan & verify sets before dispatch'
  },
]

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [selectedRole, setSelectedRole] = useState<string | null>(null)
  const [mounted, setMounted] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => { setMounted(true) }, [])

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const { data, error: authError } = await supabase.auth.signInWithPassword({ email, password })

    if (authError || !data.user) {
      setError('Invalid credentials. Please try again.')
      setLoading(false)
      return
    }

    const { data: staff } = await supabase
      .from('staff').select('role').eq('id', data.user.id).single()

    if (!staff) { setError('Account not found.'); setLoading(false); return }

    if (staff.role === 'owner') router.push('/dashboard')
    else if (staff.role === 'supervisor') router.push('/supervisor')
    else if (staff.role === 'packer') router.push('/packer')
  }

  function selectRole(r: typeof ROLES[0]) {
    setSelectedRole(r.role)
    setEmail(r.email)
    setPassword(r.password)
    setError('')
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: '#080808',
      display: 'flex',
      fontFamily: "'DM Sans', system-ui, sans-serif",
      overflow: 'hidden',
    }}>
      {/* LEFT PANEL */}
      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        padding: '60px',
        position: 'relative',
        borderRight: '1px solid rgba(255,255,255,0.04)',
      }}>
        {/* Ambient orbs */}
        <div style={{
          position: 'absolute', top: '15%', left: '10%',
          width: 400, height: 400,
          background: 'radial-gradient(circle, rgba(249,115,22,0.12) 0%, transparent 70%)',
          borderRadius: '50%', pointerEvents: 'none',
          animation: mounted ? 'pulse 4s ease-in-out infinite' : 'none',
        }} />
        <div style={{
          position: 'absolute', bottom: '20%', right: '5%',
          width: 300, height: 300,
          background: 'radial-gradient(circle, rgba(59,130,246,0.08) 0%, transparent 70%)',
          borderRadius: '50%', pointerEvents: 'none',
        }} />

        {/* Logo */}
        <div style={{ marginBottom: 64, position: 'relative' }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 12,
            padding: '10px 20px',
            border: '1px solid rgba(249,115,22,0.2)',
            borderRadius: 12,
            background: 'rgba(249,115,22,0.05)',
            marginBottom: 48,
          }}>
            <div style={{
              width: 28, height: 28,
              display: 'grid', gridTemplateColumns: '1fr 1fr',
              gap: 3,
            }}>
              {[0.9, 0.3, 0.3, 0.9].map((op, i) => (
                <div key={i} style={{
                  background: `rgba(249,115,22,${op})`,
                  borderRadius: 3,
                }} />
              ))}
            </div>
            <span style={{ color: '#f97316', fontWeight: 700, fontSize: 15, letterSpacing: '-0.3px' }}>
              BrokenSet
            </span>
          </div>

          <h1 style={{
            fontSize: 52,
            fontWeight: 800,
            color: '#ffffff',
            lineHeight: 1.05,
            letterSpacing: '-2px',
            marginBottom: 20,
          }}>
            Stop the<br />
            <span style={{
              background: 'linear-gradient(135deg, #f97316, #fb923c)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}>invisible loss.</span>
          </h1>

          <p style={{
            color: 'rgba(255,255,255,0.35)',
            fontSize: 16,
            lineHeight: 1.7,
            maxWidth: 380,
          }}>
            Every piece tracked. Every checkpoint enforced.
            Every discrepancy caught before it costs you.
          </p>
        </div>

        {/* Stats */}
        <div style={{ display: 'flex', gap: 32 }}>
          {[
            { value: '4', label: 'Control Points' },
            { value: '3', label: 'Role Layers' },
            { value: '0', label: 'Broken Sets Ship' },
          ].map(({ value, label }) => (
            <div key={label}>
              <div style={{
                fontSize: 32, fontWeight: 800, color: '#f97316',
                letterSpacing: '-1px',
              }}>{value}</div>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)', marginTop: 2 }}>
                {label}
              </div>
            </div>
          ))}
        </div>

        {/* Bottom ticker */}
        <div style={{
          position: 'absolute', bottom: 32, left: 60,
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <div style={{
            width: 6, height: 6, borderRadius: '50%',
            background: '#22c55e',
            boxShadow: '0 0 8px #22c55e',
            animation: mounted ? 'blink 2s ease-in-out infinite' : 'none',
          }} />
          <span style={{ color: 'rgba(255,255,255,0.25)', fontSize: 12 }}>
            System operational — all checkpoints active
          </span>
        </div>
      </div>

      {/* RIGHT PANEL */}
      <div style={{
        width: 480,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        padding: '60px 48px',
        background: 'rgba(255,255,255,0.01)',
        position: 'relative',
      }}>
        <div style={{ marginBottom: 32 }}>
          <h2 style={{
            fontSize: 24, fontWeight: 700,
            color: '#fff', letterSpacing: '-0.5px', marginBottom: 6,
          }}>
            Sign in to your dashboard
          </h2>
          <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 14 }}>
            Select your role or enter credentials below
          </p>
        </div>

        {/* Role selector */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 28 }}>
          {ROLES.map((r) => (
            <button
              key={r.role}
              onClick={() => selectRole(r)}
              style={{
                display: 'flex', alignItems: 'center', gap: 14,
                padding: '14px 16px',
                background: selectedRole === r.role ? r.bg : 'rgba(255,255,255,0.02)',
                border: `1px solid ${selectedRole === r.role ? r.border : 'rgba(255,255,255,0.06)'}`,
                borderRadius: 12,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                textAlign: 'left',
              }}
            >
              <div style={{
                width: 36, height: 36,
                borderRadius: 8,
                background: selectedRole === r.role ? r.bg : 'rgba(255,255,255,0.03)',
                border: `1px solid ${selectedRole === r.role ? r.border : 'rgba(255,255,255,0.06)'}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 14,
                color: r.color,
                flexShrink: 0,
              }}>
                {r.icon}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{
                  fontSize: 13, fontWeight: 600,
                  color: selectedRole === r.role ? r.color : 'rgba(255,255,255,0.7)',
                }}>
                  {r.role}
                </div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.25)', marginTop: 1 }}>
                  {r.desc}
                </div>
              </div>
              {selectedRole === r.role && (
                <div style={{
                  width: 6, height: 6, borderRadius: '50%',
                  background: r.color,
                  boxShadow: `0 0 8px ${r.color}`,
                }} />
              )}
            </button>
          ))}
        </div>

        {/* Divider */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24,
        }}>
          <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.06)' }} />
          <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.2)' }}>OR ENTER MANUALLY</span>
          <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.06)' }} />
        </div>

        {/* Form */}
        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="Email address"
            required
            style={{
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 10,
              padding: '13px 16px',
              color: '#fff',
              fontSize: 14,
              outline: 'none',
              transition: 'border-color 0.15s',
            }}
            onFocus={e => e.target.style.borderColor = 'rgba(249,115,22,0.4)'}
            onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.08)'}
          />
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="Password"
            required
            style={{
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 10,
              padding: '13px 16px',
              color: '#fff',
              fontSize: 14,
              outline: 'none',
              transition: 'border-color 0.15s',
            }}
            onFocus={e => e.target.style.borderColor = 'rgba(249,115,22,0.4)'}
            onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.08)'}
          />

          {error && (
            <div style={{
              background: 'rgba(239,68,68,0.08)',
              border: '1px solid rgba(239,68,68,0.2)',
              borderRadius: 10, padding: '12px 16px',
              color: '#f87171', fontSize: 13,
            }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              background: loading ? 'rgba(249,115,22,0.4)' : 'linear-gradient(135deg, #f97316, #ea580c)',
              border: 'none',
              borderRadius: 10,
              padding: '14px',
              color: '#fff',
              fontSize: 14,
              fontWeight: 600,
              cursor: loading ? 'not-allowed' : 'pointer',
              marginTop: 4,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              transition: 'all 0.15s ease',
              boxShadow: loading ? 'none' : '0 4px 24px rgba(249,115,22,0.3)',
              letterSpacing: '-0.2px',
            }}
          >
            {loading ? (
              <>
                <svg style={{ animation: 'spin 1s linear infinite' }} width="16" height="16" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="10" stroke="rgba(255,255,255,0.3)" strokeWidth="3"/>
                  <path d="M12 2a10 10 0 0110 10" stroke="white" strokeWidth="3" strokeLinecap="round"/>
                </svg>
                Signing in...
              </>
            ) : `Sign in as ${selectedRole || 'User'} →`}
          </button>
        </form>

        {/* Version */}
        <div style={{
          position: 'absolute', bottom: 32,
          left: '50%', transform: 'translateX(-50%)',
          fontSize: 11, color: 'rgba(255,255,255,0.12)',
          whiteSpace: 'nowrap',
        }}>
          BrokenSet v1.0 · Inventory Integrity System
        </div>
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        @keyframes pulse { 0%,100% { opacity:1; transform:scale(1); } 50% { opacity:0.6; transform:scale(0.95); } }
        @keyframes blink { 0%,100% { opacity:1; } 50% { opacity:0.3; } }
        @keyframes spin { from { transform:rotate(0deg); } to { transform:rotate(360deg); } }
        input::placeholder { color: rgba(255,255,255,0.2); }
      `}</style>
    </div>
  )
}