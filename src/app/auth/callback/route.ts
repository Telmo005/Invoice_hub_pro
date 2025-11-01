import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextResponse, type NextRequest } from 'next/server'
import { logAuthEvent } from '@/lib/security/audit-log'
import { ROUTES } from '@/config/routes'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const error = requestUrl.searchParams.get('error')
  const errorDescription = requestUrl.searchParams.get('error_description')
  const redirectTo = requestUrl.searchParams.get('redirect_to') || ROUTES.DASHBOARD

  await logAuthEvent({
    event: 'auth_callback_attempt',
    metadata: { code: !!code, error, redirectTo }
  })

  if (error) {
    await logAuthEvent({
      event: 'auth_callback_failed',
      metadata: { error, errorDescription }
    })
    
    return NextResponse.redirect(
      `${requestUrl.origin}/login?error=${encodeURIComponent(errorDescription || error)}`
    )
  }

  if (!code) {
    await logAuthEvent({
      event: 'auth_callback_missing_code',
      metadata: { url: requestUrl.toString() }
    })
    
    return NextResponse.redirect(
      `${requestUrl.origin}/login?error=missing_auth_code`
    )
  }

  try {
    const supabase = createRouteHandlerClient({ cookies })
    const { error: supabaseError } = await supabase.auth.exchangeCodeForSession(code)

    if (supabaseError) {
      await logAuthEvent({
        event: 'auth_session_exchange_failed',
        metadata: { error: supabaseError.message }
      })
      
      return NextResponse.redirect(
        `${requestUrl.origin}/login?error=auth_session_failed`
      )
    }

    const safeRedirect = redirectTo.startsWith('/') ? redirectTo : ROUTES.DASHBOARD
    
    await logAuthEvent({
      event: 'auth_callback_success',
      metadata: { redirectTo: safeRedirect }
    })
    
    return NextResponse.redirect(`${requestUrl.origin}${safeRedirect}`)

  } catch (err) {
    await logAuthEvent({
      event: 'auth_callback_exception',
      metadata: { error: (err as Error).message }
    })
    
    return NextResponse.redirect(
      `${requestUrl.origin}/login?error=unexpected_error`
    )
  }
}