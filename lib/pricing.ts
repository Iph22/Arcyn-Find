import { supabase } from './supabase'
import { getCurrentUser } from '@/lib/google-auth'

export interface PricingHistory {
  id: string
  tool_id: string
  pricing_text: string
  pricing_tier?: string
  price_amount?: number
  currency?: string
  recorded_at: string
  source?: string
}

export interface PriceAlert {
  id: string
  tool_id: string
  user_id: string
  alert_type: 'price_drop' | 'price_increase' | 'any_change'
  threshold_price?: number
  is_active: boolean
  created_at: string
}

/**
 * Get pricing history for a tool
 */
export async function getPricingHistory(
  toolId: string,
  limit: number = 30
): Promise<PricingHistory[]> {
  try {
    const { data, error } = await supabase
      .from('pricing_history')
      .select('*')
      .eq('tool_id', toolId)
      .order('recorded_at', { ascending: false })
      .limit(limit)

    if (error) throw error

    return data || []
  } catch (error) {
    console.error('Error fetching pricing history:', error)
    return []
  }
}

/**
 * Record pricing change (typically called by admin/scraper)
 */
export async function recordPricingChange(
  toolId: string,
  pricingText: string,
  pricingTier?: string,
  priceAmount?: number,
  currency: string = 'USD',
  source: string = 'manual'
): Promise<{ success: boolean; error?: string }> {
  try {
    // Check if this is different from the last recorded price
    const { data: lastPrice } = await supabase
      .from('pricing_history')
      .select('pricing_text, price_amount')
      .eq('tool_id', toolId)
      .order('recorded_at', { ascending: false })
      .limit(1)
      .single()

    // Only record if price changed
    if (lastPrice && lastPrice.pricing_text === pricingText && lastPrice.price_amount === priceAmount) {
      return { success: true } // No change, but success
    }

    const { error } = await supabase
      .from('pricing_history')
      .insert({
        tool_id: toolId,
        pricing_text: pricingText,
        pricing_tier: pricingTier || null,
        price_amount: priceAmount || null,
        currency,
        source,
      })

    if (error) throw error

    // Update the tool's current pricing
    await supabase
      .from('ai_tools')
      .update({ pricing: pricingText })
      .eq('id', toolId)

    return { success: true }
  } catch (error: any) {
    console.error('Error recording pricing change:', error)
    return { success: false, error: error.message || 'Failed to record pricing change' }
  }
}

/**
 * Get user's price alerts
 */
export async function getUserPriceAlerts(): Promise<PriceAlert[]> {
  try {
    const user = await getCurrentUser()
    if (!user) return []

    const { data, error } = await supabase
      .from('price_alerts')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .order('created_at', { ascending: false })

    if (error) throw error

    return data || []
  } catch (error) {
    console.error('Error fetching price alerts:', error)
    return []
  }
}

/**
 * Create a price alert
 */
export async function createPriceAlert(
  toolId: string,
  alertType: 'price_drop' | 'price_increase' | 'any_change',
  thresholdPrice?: number
): Promise<{ success: boolean; alert?: PriceAlert; error?: string }> {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return { success: false, error: 'You must be logged in to create a price alert' }
    }

    const { data, error } = await supabase
      .from('price_alerts')
      .insert({
        tool_id: toolId,
        user_id: user.id,
        alert_type: alertType,
        threshold_price: thresholdPrice || null,
        is_active: true,
      })
      .select()
      .single()

    if (error) {
      if (error.code === '23505') { // Unique constraint
        return { success: false, error: 'You already have an alert for this tool' }
      }
      throw error
    }

    return { success: true, alert: data as PriceAlert }
  } catch (error: any) {
    console.error('Error creating price alert:', error)
    return { success: false, error: error.message || 'Failed to create price alert' }
  }
}

/**
 * Update a price alert
 */
export async function updatePriceAlert(
  alertId: string,
  updates: {
    alert_type?: 'price_drop' | 'price_increase' | 'any_change'
    threshold_price?: number
    is_active?: boolean
  }
): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return { success: false, error: 'You must be logged in' }
    }

    const { error } = await supabase
      .from('price_alerts')
      .update(updates)
      .eq('id', alertId)
      .eq('user_id', user.id)

    if (error) throw error

    return { success: true }
  } catch (error: any) {
    console.error('Error updating price alert:', error)
    return { success: false, error: error.message || 'Failed to update price alert' }
  }
}

/**
 * Delete a price alert
 */
export async function deletePriceAlert(alertId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return { success: false, error: 'You must be logged in' }
    }

    const { error } = await supabase
      .from('price_alerts')
      .delete()
      .eq('id', alertId)
      .eq('user_id', user.id)

    if (error) throw error

    return { success: true }
  } catch (error: any) {
    console.error('Error deleting price alert:', error)
    return { success: false, error: error.message || 'Failed to delete price alert' }
  }
}

