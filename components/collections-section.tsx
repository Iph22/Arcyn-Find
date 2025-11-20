"use client"

import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Plus, Folder, Edit, Trash2, Lock, Globe, X, Save } from "lucide-react"
import { getUserCollections, createCollection, updateCollection, deleteCollection, addToolToCollection, removeToolFromCollection, type Collection } from "@/lib/collections"
import { getCurrentUser } from "@/lib/auth"
import type { User } from "@supabase/supabase-js"
import { AuthModal } from "@/components/auth-modal"
import Link from "next/link"

interface CollectionsSectionProps {
  toolId: string
  toolName: string
}

export function CollectionsSection({ toolId, toolName }: CollectionsSectionProps) {
  const [collections, setCollections] = useState<Collection[]>([])
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<User | null>(null)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [editingCollection, setEditingCollection] = useState<Collection | null>(null)
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    is_public: false,
  })
  const [selectedCollectionId, setSelectedCollectionId] = useState<string | null>(null)
  const [showAuthModal, setShowAuthModal] = useState(false)

  useEffect(() => {
    loadUser()
  }, [])

  useEffect(() => {
    if (user) {
      loadCollections()
    }
  }, [user])

  const loadUser = async () => {
    const currentUser = await getCurrentUser()
    setUser(currentUser)
  }

  const loadCollections = async () => {
    if (!user) return
    setLoading(true)
    try {
      const userCollections = await getUserCollections(user.id)
      setCollections(userCollections)
    } catch (error) {
      console.error('Error loading collections:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) {
      setShowAuthModal(true)
      return
    }

    const result = await createCollection(formData.name, formData.description, formData.is_public)
    if (result.success && result.collection) {
      await loadCollections()
      setShowCreateForm(false)
      setFormData({ name: "", description: "", is_public: false })
      // Auto-add tool to new collection
      if (result.collection.id) {
        await addToolToCollection(result.collection.id, toolId)
        await loadCollections()
      }
    } else {
      alert(result.error || "Failed to create collection")
    }
  }

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingCollection) return

    const result = await updateCollection(editingCollection.id, {
      name: formData.name,
      description: formData.description,
      is_public: formData.is_public,
    })
    if (result.success) {
      await loadCollections()
      setEditingCollection(null)
      setFormData({ name: "", description: "", is_public: false })
    } else {
      alert(result.error || "Failed to update collection")
    }
  }

  const handleDelete = async (collectionId: string) => {
    if (!confirm("Are you sure you want to delete this collection?")) return

    const result = await deleteCollection(collectionId)
    if (result.success) {
      await loadCollections()
    } else {
      alert(result.error || "Failed to delete collection")
    }
  }

  const handleAddToCollection = async (collectionId: string) => {
    const result = await addToolToCollection(collectionId, toolId)
    if (result.success) {
      await loadCollections()
      setSelectedCollectionId(null)
    } else {
      alert(result.error || "Failed to add tool to collection")
    }
  }

  const handleRemoveFromCollection = async (collectionId: string) => {
    const result = await removeToolFromCollection(collectionId, toolId)
    if (result.success) {
      await loadCollections()
    } else {
      alert(result.error || "Failed to remove tool from collection")
    }
  }

  const startEdit = (collection: Collection) => {
    setEditingCollection(collection)
    setFormData({
      name: collection.name,
      description: collection.description || "",
      is_public: collection.is_public,
    })
    setShowCreateForm(true)
  }

  if (!user) {
    return (
      <div className="mt-8 rounded-xl border border-border/50 bg-card p-6 text-center">
        <p className="text-muted-foreground mb-4">Sign in to create and manage collections</p>
        <button
          onClick={() => setShowAuthModal(true)}
          className="inline-block rounded-lg bg-accent px-4 py-2 font-medium text-accent-foreground hover:bg-accent/90"
        >
          Sign In
        </button>
        <AuthModal
          isOpen={showAuthModal}
          onClose={() => setShowAuthModal(false)}
          initialMode="signin"
        />
      </div>
    )
  }

  if (loading) {
    return (
      <div className="mt-8">
        <div className="h-32 animate-pulse rounded-xl border border-border/50 bg-card/50" />
      </div>
    )
  }

  const toolInCollections = collections.filter(c => 
    c.tool_count && c.tool_count > 0
  ).map(c => c.id)

  return (
    <div className="mt-8 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-bold">Collections</h3>
        <button
          onClick={() => {
            setEditingCollection(null)
            setFormData({ name: "", description: "", is_public: false })
            setShowCreateForm(true)
          }}
          className="flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-foreground hover:bg-accent/90"
        >
          <Plus className="h-4 w-4" />
          New Collection
        </button>
      </div>

      {/* Create/Edit Form */}
      <AnimatePresence>
        {showCreateForm && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="rounded-xl border border-border/50 bg-card p-6"
          >
            <h4 className="text-lg font-semibold mb-4">
              {editingCollection ? "Edit Collection" : "Create New Collection"}
            </h4>
            <form onSubmit={editingCollection ? handleUpdate : handleCreate} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Name *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2"
                  placeholder="My AI Tools"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Description</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 min-h-[80px]"
                  placeholder="Describe this collection..."
                />
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="is_public"
                  checked={formData.is_public}
                  onChange={(e) => setFormData({ ...formData, is_public: e.target.checked })}
                  className="rounded border-border"
                />
                <label htmlFor="is_public" className="text-sm flex items-center gap-2">
                  <Globe className="h-4 w-4" />
                  Make this collection public
                </label>
              </div>
              <div className="flex gap-2">
                <button
                  type="submit"
                  className="flex items-center gap-2 rounded-lg bg-accent px-4 py-2 font-medium text-accent-foreground hover:bg-accent/90"
                >
                  <Save className="h-4 w-4" />
                  {editingCollection ? "Update" : "Create"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateForm(false)
                    setEditingCollection(null)
                    setFormData({ name: "", description: "", is_public: false })
                  }}
                  className="rounded-lg border border-border px-4 py-2 font-medium hover:bg-muted"
                >
                  Cancel
                </button>
              </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Add to Collection Selector */}
      {selectedCollectionId === null && collections.length > 0 && (
        <div className="rounded-xl border border-border/50 bg-card p-4">
          <p className="text-sm font-medium mb-3">Add "{toolName}" to a collection:</p>
          <div className="flex flex-wrap gap-2">
            {collections.map((collection) => {
              const isInCollection = toolInCollections.includes(collection.id)
              return (
                <button
                  key={collection.id}
                  onClick={() => isInCollection ? handleRemoveFromCollection(collection.id) : handleAddToCollection(collection.id)}
                  className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                    isInCollection
                      ? "bg-accent/20 text-accent border border-accent/50"
                      : "bg-muted hover:bg-muted/80 border border-border"
                  }`}
                >
                  <Folder className="h-4 w-4" />
                  {collection.name}
                  {collection.is_public ? (
                    <Globe className="h-3 w-3" aria-label="Public" />
                  ) : (
                    <Lock className="h-3 w-3" aria-label="Private" />
                  )}
                  {isInCollection && <span className="text-xs">✓</span>}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Collections List */}
      {collections.length === 0 ? (
        <div className="rounded-xl border border-border/50 bg-card p-8 text-center">
          <Folder className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground mb-4">You don't have any collections yet</p>
          <button
            onClick={() => setShowCreateForm(true)}
            className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 font-medium text-accent-foreground hover:bg-accent/90"
          >
            <Plus className="h-4 w-4" />
            Create Your First Collection
          </button>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {collections.map((collection) => (
            <motion.div
              key={collection.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-xl border border-border/50 bg-card p-4"
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <Folder className="h-5 w-5 text-accent" />
                    <h4 className="font-semibold">{collection.name}</h4>
                    {collection.is_public ? (
                      <Globe className="h-4 w-4 text-muted-foreground" aria-label="Public" />
                    ) : (
                      <Lock className="h-4 w-4 text-muted-foreground" aria-label="Private" />
                    )}
                  </div>
                  {collection.description && (
                    <p className="text-sm text-muted-foreground mb-2">{collection.description}</p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    {collection.tool_count || 0} {collection.tool_count === 1 ? "tool" : "tools"}
                  </p>
                </div>
                <div className="flex gap-1">
                  <button
                    onClick={() => startEdit(collection)}
                    className="rounded-lg p-2 hover:bg-muted transition-colors"
                    title="Edit collection"
                  >
                    <Edit className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(collection.id)}
                    className="rounded-lg p-2 hover:bg-muted transition-colors text-red-400"
                    title="Delete collection"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
              <Link
                href={`/collections/${collection.id}`}
                className="text-sm text-accent hover:underline"
              >
                View Collection →
              </Link>
            </motion.div>
          ))}
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

