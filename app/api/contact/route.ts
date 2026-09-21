/**
 * Contact Form API Route - Security Hardened
 *
 * Security Features:
 * - Strict rate limiting (IP-based, 3/min)
 * - Schema-based input validation
 * - XSS sanitization on all inputs
 * - Length limits on all fields
 * - Rejects unexpected fields
 *
 * Durability: the submission is written to `contact_submissions` BEFORE the
 * email is attempted, and the send outcome is recorded against that row. Mail
 * is a notification, not the system of record. This route used to email and
 * nothing else, to a hardcoded address that is an ImprovMX forwarding alias
 * rather than a mailbox — when a message was accepted by Resend but never
 * arrived, there was no trace of it anywhere. See add_contact_submissions.sql.
 */

import { NextRequest } from "next/server"
import { Resend } from "resend"
import { createErrorResponse, createSuccessResponse, ErrorCodes } from "@/lib/api-errors"
import { recordEmailOutcome, storeSubmission } from "@/lib/services/contact.service"
import { logger } from "@/lib/logger"
import {
  checkRateLimit,
  createRateLimitResponse,
  getRateLimitHeaders,
  RATE_LIMIT_PRESETS,
  parseAndValidateBody,
  contactFormSchema,
  sanitizeHtml
} from "@/lib/security"

// Ensure this runs on Node.js runtime (required for Resend)
export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  try {
    // =========================================================================
    // RATE LIMITING - Strict limits for contact form (prevent spam)
    // =========================================================================
    const rateLimit = checkRateLimit(request, RATE_LIMIT_PRESETS.CONTACT)

    if (!rateLimit.allowed) {
      logger.warn('[Contact] Rate limit exceeded:', {
        remaining: rateLimit.remaining,
        resetAt: new Date(rateLimit.resetTime).toISOString()
      })
      return createRateLimitResponse(
        rateLimit,
        'Too many contact form submissions. Please wait before trying again.'
      )
    }

    // =========================================================================
    // INPUT VALIDATION - Schema-based with sanitization
    // =========================================================================
    const parseResult = await parseAndValidateBody(request, contactFormSchema)

    if ('error' in parseResult) {
      return parseResult.error
    }

    // Exactly what the sender typed: validation no longer escapes on input,
    // so these are safe for the database, the subject header and the text
    // part, and get escaped once below where they enter HTML.
    const { name, email, subject, message } = parseResult.data

    // =========================================================================
    // PERSIST FIRST — before anything that can fail outside this process
    // =========================================================================
    const forwarded = request.headers.get("x-forwarded-for")
    const clientIp = forwarded ? forwarded.split(",")[0].trim() : null

    // The service hashes the address; the raw value never reaches the table.
    const submissionId = await storeSubmission({ name, email, subject, message, ip: clientIp })

    // =========================================================================
    // EMAIL SENDING — a notification about the row above, not the record itself
    // =========================================================================
    const resendApiKey = process.env.RESEND_API_KEY

    if (!resendApiKey) {
      logger.error("[Contact] RESEND_API_KEY is not configured")

      if (submissionId) {
        await recordEmailOutcome(submissionId, { status: "not_configured" })
      }

      // Stored but not sent is a success for the person submitting: their
      // message is safe and readable in the table. Only a total loss — no row
      // AND no mail — is worth failing the request over.
      if (!submissionId) {
        return createErrorResponse(
          new Error("Email service is not configured. Please contact us directly at hello@arcynfind.com"),
          500,
          ErrorCodes.INTERNAL_ERROR
        )
      }

      return createSuccessResponse({
        success: true,
        stored: true,
        emailed: false,
        submissionId,
      })
    }

    // Initialize Resend inside the handler
    const resend = new Resend(resendApiKey)

    // Escaped exactly once, for the HTML body only. Deliberately not reused in
    // the subject header or the text part below: neither decodes entities, so
    // they take the raw values and would otherwise show `&#x2F;` per slash.
    const safeName = sanitizeHtml(name)
    const safeEmail = sanitizeHtml(email)
    const safeSubject = sanitizeHtml(subject)
    const safeMessage = sanitizeHtml(message)

    // Use onresend.com domain for testing, or your verified domain
    const fromEmail = process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev"

    const { data, error } = await resend.emails.send({
      from: `Arcyn Find <${fromEmail}>`,
      to: ["hello@arcynfind.com"],
      replyTo: email, // Original email for reply
      // A subject header is not HTML and decodes no entities, so it takes the
      // recovered text. The widget puts the page path here, which is slashes.
      subject: `Contact Form: ${subject}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333; border-bottom: 2px solid #0070f3; padding-bottom: 10px;">
            New Contact Form Submission
          </h2>
          
          <div style="margin: 20px 0;">
            <p><strong>Name:</strong> ${safeName}</p>
            <p><strong>Email:</strong> ${safeEmail}</p>
            <p><strong>Subject:</strong> ${safeSubject}</p>
          </div>
          
          <div style="background: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <h3 style="margin-top: 0;">Message:</h3>
            <p style="white-space: pre-wrap;">${safeMessage}</p>
          </div>
          
          <p style="color: #666; font-size: 12px; margin-top: 30px;">
            This email was sent from the Arcyn Find contact form.
          </p>
        </div>
      `,
      text: `
New Contact Form Submission

Name: ${name}
Email: ${email}
Subject: ${subject}

Message:
${message}
      `,
    })

    if (error) {
      logger.error("[Contact] Resend error:", error)
      const errorMessage = error instanceof Error
        ? error.message
        : typeof error === 'string'
          ? error
          : "Failed to send email. Please try again or contact us directly at hello@arcynfind.com"

      if (submissionId) {
        await recordEmailOutcome(submissionId, { status: "failed", error: errorMessage })
        // The message is on disk and queryable, so this is not a failure from
        // the sender's point of view — telling them to retry would only
        // duplicate a submission that was never lost.
        return createSuccessResponse({
          success: true,
          stored: true,
          emailed: false,
          submissionId,
        })
      }

      // Nothing stored and nothing sent: this one really did evaporate.
      return createErrorResponse(
        new Error(errorMessage),
        500,
        ErrorCodes.INTERNAL_ERROR
      )
    }

    if (submissionId) {
      await recordEmailOutcome(submissionId, { status: "sent", id: data?.id })
    }

    // Success response with rate limit headers
    const response = createSuccessResponse({
      success: true,
      stored: !!submissionId,
      emailed: true,
      messageId: data?.id,
    })

    // Add rate limit headers for client awareness
    const headers = getRateLimitHeaders(rateLimit)
    Object.entries(headers).forEach(([key, value]) => {
      response.headers.set(key, value)
    })

    return response
  } catch (error) {
    logger.error("[Contact] Error processing contact form:", error)
    return createErrorResponse(
      error instanceof Error ? error.message : "Failed to process request",
      500,
      ErrorCodes.INTERNAL_ERROR
    )
  }
}
