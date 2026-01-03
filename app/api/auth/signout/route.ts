import { NextResponse } from 'next/server'
import { deleteSession } from '@/lib/google-auth'

export async function POST() {
    try {
        await deleteSession()

        return NextResponse.json({ success: true })
    } catch (error) {
        console.error('Error signing out:', error)
        return NextResponse.json(
            { success: false, error: 'Failed to sign out' },
            { status: 500 }
        )
    }
}
