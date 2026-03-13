import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
})

// FEATURE 1: Bill OCR — extract set info from supplier invoice photo
export async function extractBillData(base64Image: string): Promise<{
  supplier_name: string
  product_name: string
  sets_count: number
  pieces_per_set: number
  total_pieces: number
  confidence: number
}> {
  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1000,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: 'image/jpeg',
              data: base64Image,
            },
          },
          {
            type: 'text',
            text: `You are an OCR system for a garment wholesale warehouse in India.
Extract billing information from this supplier invoice image.
Return ONLY a valid JSON object with these exact fields:
{
  "supplier_name": "name of supplier company",
  "product_name": "name of garment/set product",
  "sets_count": number of sets (integer),
  "pieces_per_set": pieces per set (integer),
  "total_pieces": total pieces (integer),
  "confidence": confidence score 0-100 (integer)
}
If you cannot read a field clearly, use reasonable defaults.
Return ONLY the JSON, no other text.`,
          },
        ],
      },
    ],
  })

  const text = response.content[0].type === 'text' ? response.content[0].text : '{}'
  const clean = text.replace(/```json|```/g, '').trim()
  return JSON.parse(clean)
}

// FEATURE 2: Theft Pattern Detection — analyze discrepancy logs
export async function detectTheftPatterns(data: {
  discrepancies: Array<{
    staff_name: string
    shift: string
    stage: string
    delta: number
    date: string
    location: string
  }>
  period_days: number
}): Promise<{
  risk_level: 'low' | 'medium' | 'high' | 'critical'
  top_suspect: string
  pattern_summary: string
  recommendations: string[]
  shift_analysis: string
  confidence: number
}> {
  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1000,
    messages: [
      {
        role: 'user',
        content: `You are an inventory theft detection AI for a garment wholesale warehouse in India.
Analyze these discrepancy logs from the last ${data.period_days} days and identify theft patterns.

DISCREPANCY DATA:
${JSON.stringify(data.discrepancies, null, 2)}

Return ONLY a valid JSON object with these exact fields:
{
  "risk_level": "low" | "medium" | "high" | "critical",
  "top_suspect": "staff name or shift with highest correlation to losses",
  "pattern_summary": "2-3 sentence human-readable summary of the pattern found",
  "recommendations": ["action 1", "action 2", "action 3"],
  "shift_analysis": "which shift has highest loss rate and why",
  "confidence": confidence score 0-100
}
Return ONLY the JSON, no other text.`,
      },
    ],
  })

  const text = response.content[0].type === 'text' ? response.content[0].text : '{}'
  const clean = text.replace(/```json|```/g, '').trim()
  return JSON.parse(clean)
}

// FEATURE 3: Smart Audit Suggestions
export async function suggestAudits(batches: Array<{
  batch_id: string
  product_name: string
  days_in_storage: number
  last_accessed_by: string
  access_count: number
  integrity_score: number
}>): Promise<{
  priority_batch_id: string
  reason: string
  urgency: 'low' | 'medium' | 'high'
}[]> {
  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1000,
    messages: [
      {
        role: 'user',
        content: `You are an inventory audit scheduler for a garment warehouse.
Based on these batches, suggest which ones need urgent spot audits.

BATCH DATA:
${JSON.stringify(batches, null, 2)}

Return ONLY a valid JSON array:
[
  {
    "priority_batch_id": "batch id",
    "reason": "short reason why this needs audit",
    "urgency": "low" | "medium" | "high"
  }
]
Sort by urgency descending. Return ONLY the JSON array, no other text.`,
      },
    ],
  })

  const text = response.content[0].type === 'text' ? response.content[0].text : '[]'
  const clean = text.replace(/```json|```/g, '').trim()
  return JSON.parse(clean)
}