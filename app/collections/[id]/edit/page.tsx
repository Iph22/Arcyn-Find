"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import { motion } from "framer-motion"
import { ArrowLeft, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Card } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { toast } from "sonner"
import { Sidebar } from "@/components/sidebar"
import { ThemeToggle } from "@/components/theme-toggle"
import { LanguagePicker } from "@/components/language-picker"

export default function EditCollectionPage() {
  const router = useRouter()
  const params = useParams()
  const collectionId = Array.isArray(params.id) ? params.id[0] : params.id || ""
  
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [isPublic, setIsPublic] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    const fetchCollection = async () => {
      try {
        const response = await fetch(`/api/collections/${collectionId}`)
        if (response.ok) {
          const data = await response.json()
          setName(data.collection.name)
          setDescription(data.collection.description || "")
          setIsPublic(data.collection.is_public || false)
        }
      } catch (error) {
        console.error('Error fetching collection:', error)
        toast.error('Failed to load collection')
      } finally {
        setIsLoading(false)
      }
    }

    if (collectionId) {
      fetchCollection()
    }
  }, [collectionId])

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!name.trim()) {
      toast.error('Please enter a collection name')
      return
    }

    setIsSaving(true)
    try {
      const response = await fetch(`/api/collections/${collectionId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || null,
          is_public: isPublic
        })
      })

      if (response.ok) {
        toast.success('Collection updated successfully!')
        router.push(`/collections/${collectionId}`)
      } else {
        const error = await response.json()
        toast.error(error.message || 'Failed to update collection')
      }
    } catch (error) {
      console.error('Error updating collection:', error)
      toast.error('Failed to update collection')
    } finally {
      setIsSaving(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex h-screen overflow-hidden bg-background">
        <div className="hidden md:block">
          <Sidebar />
        </div>
        <div className="flex-1 flex items-center justify-center pb-20 md:pb-0">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <div className="hidden md:block">
        <Sidebar />
      </div>
      
      <div className="flex flex-1 flex-col overflow-hidden pb-20 md:pb-0">
        {/* Header */}
        <motion.header
          className="border-b border-border/40 bg-card/50 backdrop-blur-xl"
          initial={{ y: -50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
        >
          <div className="flex items-center justify-between px-6 py-4">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" onClick={() => router.back()}>
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <h1 className="text-lg font-bold">Edit Collection</h1>
            </div>
            <div className="flex items-center gap-2">
              <LanguagePicker />
              <ThemeToggle />
            </div>
          </div>
        </motion.header>

        {/* Content */}
        <main className="flex-1 overflow-y-auto p-6">
          <div className="mx-auto max-w-2xl">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <Card className="p-6">
                <form onSubmit={handleSave} className="space-y-6">
                  <div>
                    <Label htmlFor="name">Collection Name *</Label>
                    <Input
                      id="name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="My Awesome AI Tools"
                      className="mt-2"
                      maxLength={100}
                      required
                    />
                  </div>

                  <div>
                    <Label htmlFor="description">Description (Optional)</Label>
                    <Textarea
                      id="description"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="A collection of my favorite AI tools for..."
                      className="mt-2"
                      rows={4}
                      maxLength={500}
                    />
                    <p className="mt-1 text-xs text-muted-foreground">
                      {description.length}/500 characters
                    </p>
                  </div>

                  <div className="flex items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <Label htmlFor="public">Make Public</Label>
                      <p className="text-sm text-muted-foreground">
                        Allow others to view this collection
                      </p>
                    </div>
                    <Switch
                      id="public"
                      checked={isPublic}
                      onCheckedChange={setIsPublic}
                    />
                  </div>

                  <div className="flex gap-3 pt-4">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => router.back()}
                      disabled={isSaving}
                      className="flex-1"
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      disabled={isSaving || !name.trim()}
                      className="flex-1"
                    >
                      {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Save Changes
                    </Button>
                  </div>
                </form>
              </Card>
            </motion.div>
          </div>
        </main>
      </div>
    </div>
  )
}
