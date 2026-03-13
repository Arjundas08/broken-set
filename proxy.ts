import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()
  const path = request.nextUrl.pathname

  // Not logged in → redirect to login
  if (!user && path !== '/login') {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // Already logged in + on login page → redirect to dashboard
  if (user && path === '/login') {
    const { data: staff } = await supabase
      .from('staff')
      .select('role')
      .eq('id', user.id)
      .single()

    if (staff?.role === 'owner') return NextResponse.redirect(new URL('/dashboard', request.url))
    if (staff?.role === 'supervisor') return NextResponse.redirect(new URL('/supervisor', request.url))
    if (staff?.role === 'packer') return NextResponse.redirect(new URL('/packer', request.url))
  }

  // Role protection
  if (user && path.startsWith('/dashboard')) {
    const { data: staff } = await supabase
      .from('staff').select('role').eq('id', user.id).single()
    if (staff?.role !== 'owner')
      return NextResponse.redirect(new URL('/login', request.url))
  }

  if (user && path.startsWith('/supervisor')) {
    const { data: staff } = await supabase
      .from('staff').select('role').eq('id', user.id).single()
    if (staff?.role !== 'supervisor')
      return NextResponse.redirect(new URL('/login', request.url))
  }

  if (user && path.startsWith('/packer')) {
    const { data: staff } = await supabase
      .from('staff').select('role').eq('id', user.id).single()
    if (staff?.role !== 'packer')
      return NextResponse.redirect(new URL('/login', request.url))
  }

  return supabaseResponse
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api).*)'],
}