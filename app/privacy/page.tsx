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
                {t("legal.englishOnly")}
              </p>
            )}

            <section>
              <h2 className="text-2xl font-semibold text-foreground mb-4">1. Introduction</h2>
              <p>
                Welcome to Arcyn Find. We respect your privacy and are committed to protecting your personal data.
                This privacy policy explains how we collect, use, and safeguard your information when you use our service.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-foreground mb-4">2. Information We Collect</h2>
              <p>We collect the following types of information:</p>
              <ul className="list-disc pl-6 space-y-2">
                <li><strong>Account Information:</strong> Email address, username, and profile information when you create an account</li>
                <li><strong>Google Sign-In Data:</strong> If you sign in with Google, your name, email address and profile picture, received from Google under the <code>openid</code>, <code>email</code> and <code>profile</code> scopes. See section 9.</li>
                <li><strong>Usage Data:</strong> Information about how you interact with our service, including search queries and tool views</li>
                <li><strong>Device Information:</strong> Browser type, device type, and IP address</li>
                <li><strong>Cookies:</strong> We use cookies to enhance your experience and analyze usage patterns</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-foreground mb-4">3. How We Use Your Information</h2>
              <p>We use your information to:</p>
              <ul className="list-disc pl-6 space-y-2">
                <li>Provide and improve our services</li>
                <li>Personalize your experience</li>
                <li>Send you important updates and notifications</li>
                <li>Analyze usage patterns to improve our platform</li>
                <li>Ensure security and prevent fraud</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-foreground mb-4">4. Data Sharing</h2>
              <p>
                We do not sell your personal data. We may share your information only in the following circumstances:
              </p>
              <ul className="list-disc pl-6 space-y-2">
                <li>With your explicit consent</li>
                <li>To comply with legal obligations</li>
                <li>To protect our rights and safety</li>
                <li>With service providers who assist in operating our platform (under strict confidentiality agreements)</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-foreground mb-4">5. Data Security</h2>
              <p>
                We implement industry-standard security measures to protect your data, including encryption,
                secure authentication, and regular security audits. However, no method of transmission over the
                internet is 100% secure.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-foreground mb-4">6. Your Rights</h2>
              <p>You have the right to:</p>
              <ul className="list-disc pl-6 space-y-2">
                <li>Access your personal data</li>
                <li>Correct inaccurate data</li>
                <li>Request deletion of your data</li>
                <li>Opt-out of marketing communications</li>
                <li>Export your data</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-foreground mb-4">7. Cookies</h2>
              <p>
                We use cookies to enhance your experience. You can control cookies through your browser settings,
                but this may affect some functionality of our service.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-foreground mb-4">8. Third-Party Services</h2>
              <p>
                Our service may contain links to third-party websites. We are not responsible for the privacy
                practices of these external sites. We encourage you to review their privacy policies.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-foreground mb-4">9. Google Sign-In and Google User Data</h2>
              <p>
                Signing in is optional, and Google is one way to do it. Browsing the directory,
                reading tool pages and comparing tools require no account at all.
              </p>
              <p>
                When you choose to sign in with Google, we request only the{" "}
                <code>openid</code>, <code>email</code> and <code>profile</code> scopes. These give
                us your name, email address and profile picture, and nothing else. We do not
                request, receive or have the ability to read your Gmail, Drive, Calendar,
                Contacts, or any other Google service.
              </p>
              <p>We use that information only to:</p>
              <ul className="list-disc pl-6 space-y-2">
                <li>Create and identify your account, so your saved tools, collections and reviews persist across devices</li>
                <li>Display your name and picture alongside reviews you choose to publish</li>
                <li>Send notifications you have explicitly opted into</li>
              </ul>
              <p>
                <strong>Limited Use.</strong> Arcyn Find&apos;s use and transfer of information
                received from Google APIs adheres to the{" "}
                <a
                  href="https://developers.google.com/terms/api-services-user-data-policy"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  Google API Services User Data Policy
                </a>
                , including its Limited Use requirements. We do not sell Google user data, we do
                not use it for advertising, and we do not transfer it to third parties except as
                necessary to provide the service, comply with the law, or where you have given
                explicit consent.
              </p>
              <p>
                You can revoke our access at any time from your{" "}
                <a
                  href="https://myaccount.google.com/permissions"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  Google account permissions
                </a>
                . Deleting your Arcyn Find account from your profile page removes the data we hold,
                including everything received from Google.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-foreground mb-4">10. Children's Privacy</h2>
              <p>
                Our service is not intended for children under 13. We do not knowingly collect personal information
                from children under 13.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-foreground mb-4">11. Changes to This Policy</h2>
              <p>
                We may update this privacy policy from time to time. We will notify you of any significant changes
                by posting the new policy on this page and updating the "Last updated" date.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-foreground mb-4">12. Contact Us</h2>
              <p>
                If you have questions about this privacy policy, please contact us at:
              </p>
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

