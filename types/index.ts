export type Role = 'owner' | 'supervisor' | 'packer'
export type SetStatus = 'complete' | 'opened' | 'dispatched' | 'broken'
export type DiscrepancyStage = 'inward' | 'storage' | 'outward'
export type DiscrepancyStatus = 'open' | 'investigating' | 'resolved'
export type AuditStatus = 'pending' | 'confirmed' | 'failed'
export type ActionType = 'received' | 'stored' | 'accessed' | 'audited' | 'packed' | 'dispatched' | 'flagged'
export type Shift = 'morning' | 'evening' | 'night'

export interface Location {
  id: string
  name: string
  city: string
  created_at: string
}

export interface Staff {
  id: string
  name: string
  email: string
  role: Role
  location_id: string | null
  shift: Shift | null
  created_at: string
  location?: Location
}

export interface Supplier {
  id: string
  name: string
  phone: string | null
  total_deliveries: number
  total_shortfalls: number
  trust_score: number
  created_at: string
}

export interface Product {
  id: string
  name: string
  pieces_per_set: number
  description: string | null
  created_at: string
}

export interface InwardBatch {
  id: string
  supplier_id: string
  location_id: string
  received_by: string
  product_id: string
  sets_billed: number
  sets_received: number
  pieces_billed: number
  pieces_received: number
  bill_photo_url: string | null
  notes: string | null
  created_at: string
  supplier?: Supplier
  product?: Product
  location?: Location
  staff?: Staff
}

export interface SetItem {
  id: string
  batch_id: string
  product_id: string
  location_id: string
  qr_code: string
  status: SetStatus
  integrity_score: number
  created_at: string
  product?: Product
  location?: Location
  batch?: InwardBatch
}

export interface AccessLog {
  id: string
  set_id: string
  staff_id: string
  action: ActionType
  pieces_confirmed: number | null
  expected_pieces: number | null
  notes: string | null
  photo_url: string | null
  created_at: string
  staff?: Staff
  set?: SetItem
}

export interface Discrepancy {
  id: string
  set_id: string | null
  batch_id: string
  reported_by: string
  location_id: string
  stage: DiscrepancyStage
  expected_pieces: number
  actual_pieces: number
  delta: number
  status: DiscrepancyStatus
  created_at: string
  staff?: Staff
  set?: SetItem
  location?: Location
}

export interface Audit {
  id: string
  batch_id: string
  triggered_by: string
  assigned_to: string
  status: AuditStatus
  result_pieces: number | null
  notes: string | null
  created_at: string
}

export interface DashboardStats {
  totalSetsToday: number
  inwardToday: number
  outwardToday: number
  discrepanciesOpen: number
  shrinkagePercent: number
  brokenSetsBlocked: number
}