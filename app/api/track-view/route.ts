import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'

/**
 * POST /api/track-view
 * Tracks a view/click on an AI tool and updates popularity in real-time
 */
export async function POST(request: Request) {
  try {
    const { aiId } = await request.json()
    
    if (!aiId || typeof aiId !== 'string') {
      return NextResponse.json(
        { error: 'Invalid aiId' },
        { status: 400 }
      )
    }

    const supabase = getSupabaseAdmin()
    
    // Get current tool data
    const { data: tool, error: fetchError } = await supabase
      .from('ai_tools')
      .select('popularity, name')
      .eq('id', aiId)
      .single()
    
    if (fetchError || !tool) {
      return NextResponse.json(
        { error: 'Tool not found' },
        { status: 404 }
      )
    }
    
    // Calculate new popularity based on views
    // Formula: popularity increases by 0.1 per view, capped at 100
    // Recent views have more weight (decay over time)
    const currentPopularity = tool.popularity || 50
    const popularityIncrease = 0.1
    
    // Calculate new popularity (with slight boost for trending tools)
    let newPopularity = Math.min(100, currentPopularity + popularityIncrease)
    
    // If popularity is already high, increase more slowly
    if (currentPopularity > 80) {
      newPopularity = Math.min(100, currentPopularity + (popularityIncrease * 0.5))
    }
    
    // Update popularity in database
    const { error: updateError } = await supabase
      .from('ai_tools')
      .update({ 
        popularity: Math.round(newPopularity),
        updated_at: new Date().toISOString()
      })
      .eq('id', aiId)
    
    if (updateError) {
      console.error('Error updating popularity:', updateError)
      return NextResponse.json(
        { error: 'Failed to update popularity' },
        { status: 500 }
      )
    }
    
    return NextResponse.json({ 
      success: true,
      newPopularity: Math.round(newPopularity)
    })
  } catch (error) {
    console.error('Error tracking view:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

