"use client"

import { motion } from "framer-motion"
import { ArrowLeft, Shield } from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { useLanguage } from "@/contexts/language-context"

export default function PrivacyPage() {
  const { t, language } = useLanguage()
  return (
    <div className="min-h-dvh bg-background">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <Link href="/">
          <Button variant="ghost" className="mb-8 gap-2">
            <ArrowLeft className="w-4 h-4" />
            {t("common.backHome")}
          </Button>
        </Link>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <div className="flex items-center gap-3 mb-8">
            <Shield className="w-8 h-8 text-primary" />
            <h1 className="text-4xl md:text-5xl font-bold">{t("landing.privacyPolicy")}</h1>
          </div>

          <div className="prose prose-invert max-w-none space-y-8 text-muted-foreground">
            <p className="text-sm text-muted-foreground/80">
              {t("legal.lastUpdated")} {new Date().toLocaleDateString()}
            </p>

            {language !== "en" && (
              <p className="rounded-lg border border-border bg-muted/40 px-4 py-3 text-sm">
                {t("legal.governingNotice")}
              </p>
            )}

            <section>
              <h2 className="text-2xl font-semibold text-foreground mb-4">{t("privacy.s1.title")}</h2>
              <p>{t("privacy.s1.body")}</p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-foreground mb-4">{t("privacy.s2.title")}</h2>
              <p>{t("privacy.s2.intro")}</p>
              <ul className="list-disc pl-6 space-y-2">
                <li><strong>{t("privacy.s2.accountLabel")}</strong> {t("privacy.s2.account")}</li>
                <li><strong>{t("privacy.s2.usageLabel")}</strong> {t("privacy.s2.usage")}</li>
                <li><strong>{t("privacy.s2.deviceLabel")}</strong> {t("privacy.s2.device")}</li>
                <li><strong>{t("privacy.s2.cookiesLabel")}</strong> {t("privacy.s2.cookies")}</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-foreground mb-4">{t("privacy.s3.title")}</h2>
              <p>{t("privacy.s3.intro")}</p>
              <ul className="list-disc pl-6 space-y-2">
                <li>{t("privacy.s3.i1")}</li>
                <li>{t("privacy.s3.i2")}</li>
                <li>{t("privacy.s3.i3")}</li>
                <li>{t("privacy.s3.i4")}</li>
                <li>{t("privacy.s3.i5")}</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-foreground mb-4">{t("privacy.s4.title")}</h2>
              <p>{t("privacy.s4.intro")}</p>
              <ul className="list-disc pl-6 space-y-2">
                <li>{t("privacy.s4.i1")}</li>
                <li>{t("privacy.s4.i2")}</li>
                <li>{t("privacy.s4.i3")}</li>
                <li>{t("privacy.s4.i0")}</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-foreground mb-4">{t("privacy.s5.title")}</h2>
              <p>{t("privacy.s5.body")}</p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-foreground mb-4">{t("privacy.s6.title")}</h2>
              <p>{t("privacy.s6.intro")}</p>
              <ul className="list-disc pl-6 space-y-2">
                <li>{t("privacy.s6.i1")}</li>
                <li>{t("privacy.s6.i2")}</li>
                <li>{t("privacy.s6.i3")}</li>
                <li>{t("privacy.s6.i4")}</li>
                <li>{t("privacy.s6.i5")}</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-foreground mb-4">{t("privacy.s7.title")}</h2>
              <p>{t("privacy.s7.body")}</p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-foreground mb-4">{t("privacy.s8.title")}</h2>
              <p>{t("privacy.s8.body")}</p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-foreground mb-4">{t("privacy.s9.title")}</h2>
              <p>{t("privacy.s9.body")}</p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-foreground mb-4">{t("privacy.s10.title")}</h2>
              <p>{t("privacy.s10.body")}</p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-foreground mb-4">{t("privacy.s11.title")}</h2>
              <p>{t("privacy.s11.body")}</p>
              <p>
                <strong>{t("legal.email")}</strong> <a href="mailto:hello@arcynfind.com" className="text-primary hover:underline">hello@arcynfind.com</a>
              </p>
            </section>
          </div>
        </motion.div>
      </div>
    </div>
  )
}

