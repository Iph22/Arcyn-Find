"use client"

import type React from "react"

import { useEffect, useState } from "react"
import Link from "next/link"
import { ArrowLeft, CheckCircle2, Plus, Send } from "lucide-react"
import { toast } from "sonner"

import { ArcynLogo } from "@/components/landing/arcyn-logo"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { useLanguage } from "@/contexts/language-context"
import { useAuth } from "@/contexts/auth-context"

/** Mirrors the server's own limits in app/api/tools/submit/route.ts. */
const NAME_MAX = 100
const DESCRIPTION_MAX = 500

interface SubmitOptions {
  categories: string[]
  accessTypes: string[]
}

/**
 * Submit a tool.
 *
 * The page the landing page's "Add your tool" card points at. `POST
 * /api/tools/submit` has existed for some time and had no page in front of
 * it: nothing in the app linked to it, so the endpoint the code comments call
 * "the #1 growth driver for tool directories" could not be reached by anyone
 * using the site.
 *
 * The category and access-type lists are fetched from `GET /api/tools/submit`
 * rather than duplicated here. The endpoint coerces any category it does not
 * recognise to "Other", so a hard-coded list that drifted from the server's
 * would silently file every submission under Other — and those values are
 * deliberately NOT the same vocabulary as the catalog's category pages
 * (docs/ROUTING.md: two category vocabularies exist and neither is the
 * other's slug), so they cannot be sourced from /api/categories either.
 */
export default function SubmitPage() {
  const { t } = useLanguage()
  const { user, isLoading: isAuthLoading, isAuthenticated } = useAuth()

  const [form, setForm] = useState({
    name: "",
    description: "",
    url: "",
    category: "",
    accessType: "",
    email: "",
    imageUrl: "",
  })
  const [options, setOptions] = useState<SubmitOptions>({ categories: [], accessTypes: [] })

  // Prefilled from the account. The server uses the account address
  // regardless; this is so the reader can see where the outcome will go.
  useEffect(() => {
    if (user?.email) setForm((prev) => (prev.email ? prev : { ...prev, email: user.email as string }))
  }, [user?.email])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [imageError, setImageError] = useState("")

  // Uploaded before the form is sent, so the submission carries a URL rather
  // than a payload -- the submit route stays JSON and the 2MB cap is enforced
  // by the upload endpoint, which checks the file's actual bytes rather than
  // whatever content-type the browser claimed.
  const handleImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    setImageError("")
    try {
      const data = new FormData()
      data.append("file", file)
      const res = await fetch("/api/uploads/tool-image", { method: "POST", body: data })
      const json = await res.json()
      if (!res.ok) {
        setImageError(json.error || "That image could not be uploaded.")
        return
      }
      setForm((prev) => ({ ...prev, imageUrl: json.url }))
    } catch {
      setImageError("That image could not be uploaded.")
    } finally {
      setUploading(false)
    }
  }
  const [submitted, setSubmitted] = useState(false)

  useEffect(() => {
    let cancelled = false
    fetch("/api/tools/submit")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled || !data) return
        setOptions({
          categories: Array.isArray(data.categories) ? data.categories : [],
          accessTypes: Array.isArray(data.accessTypes) ? data.accessTypes : [],
        })
      })
      // A failed options fetch costs the two dropdowns their choices, not the
      // form. Category is optional server-side and defaults to "Other".
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)

    try {
      const response = await fetch("/api/tools/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      })

      // The contact form learned this the hard way: an error page from the
      // platform is HTML, and calling .json() on it throws something that
      // reads like a bug in the form rather than a failed request.
      const contentType = response.headers.get("content-type")
      if (!contentType || !contentType.includes("application/json")) {
        throw new Error(t("submit.errorGeneric"))
      }

      const data = await response.json()
      if (!response.ok) {
        // 409 is the useful one: the catalog already holds this tool. The
        // endpoint names it when it can, and that is worth showing.
        throw new Error(
          data.existingTool
            ? t("submit.errorDuplicateNamed", { name: data.existingTool })
            : data.error || t("submit.errorGeneric")
        )
      }

      setSubmitted(true)
      toast.success(t("submit.success"))
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("submit.errorGeneric"))
    } finally {
      setIsSubmitting(false)
    }
  }

  // Gate before the form, not after it. The API refuses an unauthenticated
  // submission with 401, and discovering that after typing a description and
  // uploading a logo is a worse experience than being told up front.
  if (isAuthLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    )
  }

  if (!isAuthenticated) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="w-full max-w-md text-center">
          <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
            <Plus className="h-7 w-7 text-primary" />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">{t("submit.signInTitle")}</h1>
          <p className="mt-3 text-muted-foreground">{t("submit.signInBody")}</p>
          <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:justify-center">
            <Button asChild className="h-11">
              <Link href="/sign-in?redirect=%2Fsubmit">{t("nav.signIn")}</Link>
            </Button>
            <Button asChild variant="outline" className="h-11">
              <Link href="/sign-up?redirect=%2Fsubmit">{t("nav.getStarted")}</Link>
            </Button>
          </div>
        </div>
      </div>
    )
  }


  return (
    <div className="min-h-dvh bg-background text-foreground">
      <header className="sticky top-0 z-50 glass-header">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3 sm:px-6">
          <Link href="/" className="flex items-center gap-2" aria-label="Arcyn Find">
            <ArcynLogo className="h-6 w-6 text-primary" />
            <span className="text-lg font-bold tracking-tight">
              Arcyn <span className="text-primary">Find</span>
            </span>
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-14 pb-(--mobile-nav-clearance)">
        <Button asChild variant="ghost" size="sm" className="mb-8 gap-2 -ml-2">
          <Link href="/">
            <ArrowLeft className="h-4 w-4" />
            {t("submit.backHome")}
          </Link>
        </Button>

        {submitted ? (
          /* The success state replaces the form rather than sitting above a
             filled-in copy of it, so there is nothing to submit twice. */
          <div className="rounded-2xl border border-primary/40 bg-primary/5 p-8 text-center">
            <span className="mx-auto inline-flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
              <CheckCircle2 className="h-7 w-7" />
            </span>
            <h1 className="mt-5 text-2xl font-bold">{t("submit.successTitle")}</h1>
            <p className="mx-auto mt-3 max-w-md text-sm text-muted-foreground leading-relaxed">
              {t("submit.successBody")}
            </p>
            <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:justify-center">
              <Button asChild className="gap-2">
                <Link href="/tools">{t("landing.browseTools")}</Link>
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setForm({ name: "", description: "", url: "", category: "", accessType: "", email: "", imageUrl: "" })
                  setSubmitted(false)
                }}
              >
                {t("submit.another")}
              </Button>
            </div>
          </div>
        ) : (
          <>
            {/* `flex`, not `inline-flex`: the back Button above renders an
                inline-flex anchor, so an inline badge sat on the same line
                beside it instead of starting the page heading block. */}
            <span className="flex h-12 w-12 items-center justify-center rounded-full border border-primary/30 bg-primary/10 text-primary">
              <Plus className="h-5 w-5" />
            </span>
            <h1 className="mt-5 text-3xl sm:text-4xl font-bold tracking-tight">{t("submit.title")}</h1>
            <p className="mt-3 max-w-xl text-base text-muted-foreground leading-relaxed">
              {t("submit.subtitle")}
            </p>

            <form onSubmit={handleSubmit} className="mt-9 space-y-6">
              <div className="space-y-2">
                <Label htmlFor="tool-name">{t("submit.fieldName")}</Label>
                <Input
                  id="tool-name"
                  value={form.name}
                  onChange={set("name")}
                  required
                  maxLength={NAME_MAX}
                  placeholder={t("submit.fieldNamePlaceholder")}
                  className="h-11"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="tool-url">{t("submit.fieldUrl")}</Label>
                <Input
                  id="tool-url"
                  /* type=url so the browser validates the format before a
                     round trip -- the endpoint rejects anything new URL()
                     cannot parse. */
                  type="url"
                  value={form.url}
                  onChange={set("url")}
                  required
                  placeholder="https://example.com"
                  className="h-11"
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-baseline justify-between gap-3">
                  <Label htmlFor="tool-description">{t("submit.fieldDescription")}</Label>
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {form.description.length}/{DESCRIPTION_MAX}
                  </span>
                </div>
                <Textarea
                  id="tool-description"
                  value={form.description}
                  onChange={set("description")}
                  required
                  maxLength={DESCRIPTION_MAX}
                  rows={5}
                  placeholder={t("submit.fieldDescriptionPlaceholder")}
                />
              </div>

              <div className="grid gap-6 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="tool-category">{t("submit.fieldCategory")}</Label>
                  {/* A native <select>, not the Radix one: this form is
                      plain data entry, the list is short, and the native
                      control is what a phone keyboard and a screen reader
                      already handle best. */}
                  <select
                    id="tool-category"
                    value={form.category}
                    onChange={set("category")}
                    className="h-11 w-full rounded-md border border-input bg-transparent px-3 text-base shadow-xs outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] md:text-sm dark:bg-input/30"
                  >
                    <option value="">{t("submit.fieldCategoryDefault")}</option>
                    {options.categories.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="tool-access">{t("submit.fieldPricing")}</Label>
                  <select
                    id="tool-access"
                    value={form.accessType}
                    onChange={set("accessType")}
                    className="h-11 w-full rounded-md border border-input bg-transparent px-3 text-base shadow-xs outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] md:text-sm dark:bg-input/30"
                  >
                    <option value="">{t("submit.fieldPricingDefault")}</option>
                    {options.accessTypes.map((a) => (
                      <option key={a} value={a}>
                        {a}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="tool-image">
                  {t("submit.fieldImage")}{" "}
                  <span className="font-normal text-muted-foreground">{t("submit.optional")}</span>
                </Label>
                <div className="flex items-center gap-4">
                  {form.imageUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={form.imageUrl}
                      alt=""
                      className="h-16 w-16 rounded-xl border border-border object-cover"
                    />
                  )}
                  <div className="min-w-0 flex-1">
                    <Input
                      id="tool-image"
                      type="file"
                      accept="image/png,image/jpeg,image/gif,image/webp"
                      onChange={handleImage}
                      disabled={uploading}
                      className="h-11 cursor-pointer file:mr-3 file:cursor-pointer file:rounded-md file:border-0 file:bg-muted file:px-3 file:py-1.5 file:text-sm"
                    />
                    <p className="mt-1 text-xs text-muted-foreground">
                      {uploading
                        ? t("submit.imageUploading")
                        : imageError
                          ? imageError
                          : t("submit.fieldImageHint")}
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="tool-email">{t("submit.fieldEmail")}</Label>
                <Input
                  id="tool-email"
                  type="email"
                  value={form.email}
                  onChange={set("email")}
                  placeholder="you@example.com"
                  className="h-11"
                  required
                />
                {/* Required now, because every submission ends in a decision and
                    a decision nobody hears about reads as being ignored. */}
                <p className="text-xs text-muted-foreground">{t("submit.emailOutcomeHint")}</p>
              </div>

              <div className="flex flex-col gap-4 border-t border-border pt-6 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs text-muted-foreground max-w-sm leading-relaxed">
                  {t("submit.reviewNotice")}
                </p>
                <Button type="submit" disabled={isSubmitting} className="gap-2 h-11 shrink-0">
                  <Send className="h-4 w-4" />
                  {isSubmitting ? t("submit.sending") : t("submit.send")}
                </Button>
              </div>
            </form>
          </>
        )}
      </main>
    </div>
  )
}
