import { createAdminSupabaseClient } from '@/lib/supabase-server'
import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  try {
    const supabase = await createAdminSupabaseClient()
    const { qr_code, pieces_confirmed, staff_id } = await req.json()

    // 1. Find the set by QR code
    const { data: set, error: setError } = await supabase
      .from('sets')
      .select('*, product:products(name, pieces_per_set), location:locations(name)')
      .eq('qr_code', qr_code)
      .single()

    if (setError || !set) {
      return NextResponse.json({ error: 'Set not found. Invalid QR code.' }, { status: 404 })
    }

    // 2. Already dispatched?
    if (set.status === 'dispatched') {
      return NextResponse.json({ error: 'This set has already been dispatched.' }, { status: 400 })
    }

    const expected = set.product.pieces_per_set
    const actual   = Number(pieces_confirmed)
    const delta    = actual - expected
    const isClean  = delta === 0

    // 3. Log the packer action
    await supabase.from('access_logs').insert({
      set_id:           set.id,
      staff_id,
      action:           isClean ? 'dispatched' : 'flagged',
      pieces_confirmed: actual,
      expected_pieces:  expected,
      notes:            isClean
        ? 'Piece count verified. Dispatch approved.'
        : `Piece count mismatch. Expected ${expected}, got ${actual}. Dispatch BLOCKED.`,
    })

    if (isClean) {
      // 4a. APPROVED — update set status
      await supabase
        .from('sets')
        .update({ status: 'dispatched', integrity_score: 100 })
        .eq('id', set.id)

      return NextResponse.json({
        approved: true,
        message:  'Dispatch approved ✅',
        set_name: set.product.name,
        pieces:   actual,
      })

    } else {
      // 4b. BLOCKED — update set + create discrepancy
      await supabase
        .from('sets')
        .update({
          status:          'broken',
          integrity_score: Math.round((actual / expected) * 100),
        })
        .eq('id', set.id)

      await supabase.from('discrepancies').insert({
        set_id:          set.id,
        batch_id:        set.batch_id,
        reported_by:     staff_id,
        location_id:     set.location_id,
        stage:           'outward',
        expected_pieces: expected,
        actual_pieces:   actual,
        delta,
        status:          'open',
      })

      return NextResponse.json({
        approved:  false,
        blocked:   true,
        message:   `Dispatch BLOCKED 🚫`,
        set_name:  set.product.name,
        expected,
        actual,
        delta:     Math.abs(delta),
        location:  set.location?.name,
      })
    }

  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
