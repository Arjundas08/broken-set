import { createServerSupabaseClient } from './supabase-server'
import { Staff } from '@/types'

export async function getCurrentUser(): Promise<Staff | null> {
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user }, error } = await supabase.auth.getUser()
    if (error || !user) return null

    const { data: staff } = await supabase
      .from('staff')
      .select('*, location:locations(*)')
      .eq('id', user.id)
      .single()

    return staff as Staff | null
  } catch {
    return null
  }
}

export async function requireRole(allowedRoles: string[]) {
  const user = await getCurrentUser()
  if (!user) return null
  if (!allowedRoles.includes(user.role)) return null
  return user
}