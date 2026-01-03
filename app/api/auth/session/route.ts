import { NextResponse } from 'next/server'
import { getSession } from '@/lib/google-auth'

export async function GET() {
    try {
        const session = await getSession()

        return NextResponse.json({
            user: session.user,
            isAuthenticated: session.isAuthenticated
        })
    } catch (error) {
        console.error('Error getting session:', error)
        return NextResponse.json({
            user: null,
            isAuthenticated: false
        })
    }
}
