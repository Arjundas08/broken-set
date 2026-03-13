import { createAdminSupabaseClient } from '@/lib/supabase-server'
import { extractBillData } from '@/lib/claude'
import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  try {
    const { image_base64 } = await req.json()

    if (!image_base64) {
      return NextResponse.json({ error: 'No image provided' }, { status: 400 })
    }

    // Call Claude to extract bill data
    const extracted = await extractBillData(image_base64)

    // Try to match supplier name to DB
    const supabase = await createAdminSupabaseClient()
    const { data: suppliers } = await supabase
      .from('suppliers')
      .select('id, name')

    let matched_supplier_id = null
    if (suppliers && extracted.supplier_name) {
      const match = suppliers.find((s: any) =>
        s.name.toLowerCase().includes(extracted.supplier_name.toLowerCase()) ||
        extracted.supplier_name.toLowerCase().includes(s.name.toLowerCase())
      )
      if (match) matched_supplier_id = match.id
    }

    // Try to match product name to DB
    const { data: products } = await supabase
      .from('products')
      .select('id, name, pieces_per_set')

    let matched_product_id = null
    let matched_pieces_per_set = null
    if (products && extracted.product_name) {
      const match = products.find((p: any) =>
        p.name.toLowerCase().includes(extracted.product_name.toLowerCase()) ||
        extracted.product_name.toLowerCase().includes(p.name.toLowerCase())
      )
      if (match) {
        matched_product_id    = match.id
        matched_pieces_per_set = match.pieces_per_set
      }
    }

    return NextResponse.json({
      ...extracted,
      matched_supplier_id,
      matched_product_id,
      matched_pieces_per_set,
    })

  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
