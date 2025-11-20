"use client"

import { useState, useEffect } from "react"
import { motion } from "framer-motion"
import { DollarSign, TrendingUp, TrendingDown, Bell, BellOff, AlertCircle } from "lucide-react"
import { getPricingHistory, getUserPriceAlerts, createPriceAlert, deletePriceAlert, type PricingHistory, type PriceAlert } from "@/lib/pricing"
import { getCurrentUser } from "@/lib/auth"
import { AuthModal } from "@/components/auth-modal"

interface PricingHistoryProps {
  toolId: string
  currentPricing: string
}

export function PricingHistory({ toolId, currentPricing }: PricingHistoryProps) {
  const [history, setHistory] = useState<PricingHistory[]>([])
  const [alerts, setAlerts] = useState<PriceAlert[]>([])
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<any>(null)
  const [showAlertForm, setShowAlertForm] = useState(false)
  const [alertType, setAlertType] = useState<'price_drop' | 'price_increase' | 'any_change'>('any_change')
  const [showAuthModal, setShowAuthModal] = useState(false)

  useEffect(() => {
    loadUser()
  }, [])

  useEffect(() => {
    if (toolId) {
      loadData()
    }
  }, [toolId, user])

  const loadUser = async () => {
    const currentUser = await getCurrentUser()
    setUser(currentUser)
  }

  const loadData = async () => {
    setLoading(true)
    try {
      const [historyData, alertsData] = await Promise.all([
        getPricingHistory(toolId, 30),
        user ? getUserPriceAlerts() : Promise.resolve([]),
      ])
      setHistory(historyData)
      setAlerts(alertsData.filter(a => a.tool_id === toolId))
    } catch (error) {
      console.error('Error loading pricing data:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleCreateAlert = async () => {
    if (!user) {
      alert('Please sign in to create price alerts')
      return
    }

    const result = await createPriceAlert(toolId, alertType)
    if (result.success) {
      await loadData()
      setShowAlertForm(false)
    } else {
      alert(result.error || 'Failed to create price alert')
    }
  }

  const handleDeleteAlert = async (alertId: string) => {
    const result = await deletePriceAlert(alertId)
    if (result.success) {
      await loadData()
    } else {
      alert(result.error || 'Failed to delete alert')
    }
  }

  if (loading) {
    return (
      <div className="mt-8">
        <div className="h-48 animate-pulse rounded-xl border border-border/50 bg-card/50" />
      </div>
    )
  }

  const hasAlert = alerts.length > 0
  const priceChanges = history.length > 1
  const latestPrice = history[0]?.pricing_text || currentPricing

  return (
    <div className="mt-8 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-bold">Pricing History</h3>
        {user && (
          <button
            onClick={() => setShowAlertForm(!showAlertForm)}
            className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              hasAlert
                ? "bg-accent/20 text-accent border border-accent/50"
                : "bg-muted hover:bg-muted/80 border border-border"
            }`}
          >
            {hasAlert ? (
              <>
                <Bell className="h-4 w-4" />
                Alert Active
              </>
            ) : (
              <>
                <BellOff className="h-4 w-4" />
                Set Price Alert
              </>
            )}
          </button>
        )}
      </div>

      {/* Current Pricing */}
      <div className="rounded-xl border border-border/50 bg-card p-6">
        <div className="flex items-center gap-3 mb-4">
          <DollarSign className="h-6 w-6 text-accent" />
          <div>
            <p className="text-sm text-muted-foreground">Current Pricing</p>
            <p className="text-2xl font-bold">{latestPrice}</p>
          </div>
        </div>
        {hasAlert && (
          <div className="mt-4 p-3 rounded-lg bg-accent/10 border border-accent/20">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Bell className="h-4 w-4 text-accent" />
                <span className="text-sm font-medium">Price alert active</span>
              </div>
              <button
                onClick={() => handleDeleteAlert(alerts[0].id)}
                className="text-sm text-red-400 hover:underline"
              >
                Remove
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Alert Form */}
      {showAlertForm && !hasAlert && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          className="rounded-xl border border-border/50 bg-card p-6"
        >
          <h4 className="font-semibold mb-4">Create Price Alert</h4>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Alert Type</label>
              <select
                value={alertType}
                onChange={(e) => setAlertType(e.target.value as any)}
                className="w-full rounded-lg border border-border bg-background px-3 py-2"
              >
                <option value="any_change">Any Price Change</option>
                <option value="price_drop">Price Drop</option>
                <option value="price_increase">Price Increase</option>
              </select>
            </div>
            <button
              onClick={handleCreateAlert}
              className="w-full rounded-lg bg-accent px-4 py-2 font-medium text-accent-foreground hover:bg-accent/90"
            >
              Create Alert
            </button>
          </div>
        </motion.div>
      )}

      {/* Price History */}
      {history.length > 0 ? (
        <div className="rounded-xl border border-border/50 bg-card p-6">
          <h4 className="font-semibold mb-4">Price History ({history.length} records)</h4>
          <div className="space-y-3 max-h-64 overflow-y-auto">
            {history.map((record, index) => {
              const prevRecord = history[index + 1]
              const priceChanged = prevRecord && record.pricing_text !== prevRecord.pricing_text
              const isIncrease = prevRecord && record.price_amount && prevRecord.price_amount && 
                record.price_amount > prevRecord.price_amount

              return (
                <div
                  key={record.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-muted/30"
                >
                  <div className="flex-1">
                    <p className="font-medium">{record.pricing_text}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(record.recorded_at).toLocaleDateString()}
                      {record.source && ` • ${record.source}`}
                    </p>
                  </div>
                  {priceChanged && prevRecord && (
                    <div className={`flex items-center gap-1 ${
                      isIncrease ? 'text-red-400' : 'text-green-400'
                    }`}>
                      {isIncrease ? (
                        <TrendingUp className="h-4 w-4" />
                      ) : (
                        <TrendingDown className="h-4 w-4" />
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-border/50 bg-card p-8 text-center">
          <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">No pricing history available</p>
        </div>
      )}

      {/* Auth Modal */}
      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        initialMode="signin"
      />
    </div>
  )
}

