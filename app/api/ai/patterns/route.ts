import { createAdminSupabaseClient } from '@/lib/supabase-server'
import { detectTheftPatterns } from '@/lib/claude'
import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  try {
    const { days = 30 } = await req.json()
    const supabase = await createAdminSupabaseClient()
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()

    const { data: discrepancies } = await supabase
      .from('discrepancies')
      .select('*, staff:reported_by(name,shift), location:locations(name)')
      .gte('created_at', since)

    if (!discrepancies || discrepancies.length === 0) {
      return NextResponse.json({
        risk_level: 'low',
        top_suspect: 'No data yet',
        pattern_summary: 'Not enough discrepancy data to detect patterns. Keep using the system and run analysis again later.',
        recommendations: ['Continue logging all inward and outward operations', 'Ensure all packers scan sets before dispatch'],
        shift_analysis: 'No shift data available yet.',
        confidence: 0,
      })
    }

    const formatted = discrepancies.map((d: any) => ({
      staff_name: d.staff?.name || 'Unknown',
      shift: d.staff?.shift || 'unknown',
      stage: d.stage,
      delta: d.delta,
      date: d.created_at,
      location: d.location?.name || 'Unknown',
    }))

    const result = await detectTheftPatterns({ discrepancies: formatted, period_days: days })
    return NextResponse.json(result)
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}