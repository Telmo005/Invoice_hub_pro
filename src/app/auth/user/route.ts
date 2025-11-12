// src/app/api/auth/user/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getServerUser } from '@/lib/auth/server'

export async function GET(_request: NextRequest) {
  try {
    const { user, error } = await getServerUser()

    if (error) {
      return NextResponse.json(
        { error: 'Authentication failed' },
        { status: 401 }
      )
    }

    return NextResponse.json({
      user: user
        ? {
            id: user.id,
            email: user.email,
          }
        : null,
    })
  } catch (_error) {
    console.error('Auth API error:', _error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
