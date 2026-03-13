
import { createAdminSupabaseClient } from '@/lib/supabase-server'
import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  try {
    const supabase = await createAdminSupabaseClient()
    const body = await req.json()
    const { supplier_id, location_id, received_by, product_id, sets_billed, sets_received, pieces_billed, pieces_received, bill_photo_url, notes } = body

    const { data: batch, error: batchError } = await supabase
      .from('inward_batches')
      .insert({
        supplier_id, location_id, received_by, product_id,
        sets_billed: Number(sets_billed),
        sets_received: Number(sets_received),
        pieces_billed: Number(pieces_billed),
        pieces_received: Number(pieces_received),
        bill_photo_url: bill_photo_url || null,
        notes: notes || null,
      })
      .select().single()

    if (batchError) throw batchError

    const setsToInsert = Array.from({ length: Number(sets_received) }, (_, i) => ({
      batch_id: batch.id,
      product_id,
      location_id,
      qr_code: `SET-${batch.id.slice(0,6).toUpperCase()}-${String(i + 1).padStart(3, '0')}`,
      status: 'complete',
      integrity_score: 100,
    }))

    const { error: setsError } = await supabase.from('sets').insert(setsToInsert)
    if (setsError) throw setsError

    const { data: insertedSets } = await supabase
      .from('sets').select('id').eq('batch_id', batch.id)

    if (insertedSets && insertedSets.length > 0) {
      const logs = insertedSets.map((s: any) => ({
        set_id: s.id,
        staff_id: received_by,
        action: 'received',
        pieces_confirmed: Number(pieces_received),
        expected_pieces: Number(pieces_billed),
        notes: 'Inward verification completed',
      }))
      await supabase.from('access_logs').insert(logs)
    }

    if (Number(pieces_received) < Number(pieces_billed)) {
      await supabase.from('discrepancies').insert({
        batch_id: batch.id,
        reported_by: received_by,
        location_id,
        stage: 'inward',
        expected_pieces: Number(pieces_billed),
        actual_pieces: Number(pieces_received),
        delta: Number(pieces_received) - Number(pieces_billed),
        status: 'open',
      })
    }

    return NextResponse.json({ success: true, batch, sets_created: setsToInsert.length })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function GET() {
  try {
    const supabase = await createAdminSupabaseClient()
    const { data, error } = await supabase
      .from('inward_batches')
      .select(`*, supplier:suppliers(name,trust_score), product:products(name,pieces_per_set), location:locations(name), staff:received_by(name)`)
      .order('created_at', { ascending: false }).limit(20)
    if (error) throw error
    return NextResponse.json(data)
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}