/**
 * Contact Form API Route - Security Hardened
 * 
 * Security Features:
 * - Strict rate limiting (IP-based, 3/min)
 * - Schema-based input validation
 * - XSS sanitization on all inputs
 * - Length limits on all fields
 * - Rejects unexpected fields
 */

import { NextRequest } from "next/server"
import { Resend } from "resend"
import { createErrorResponse, createSuccessResponse, ErrorCodes } from "@/lib/api-errors"
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

    const { name, email, subject, message } = parseResult.data

    // =========================================================================
    // EMAIL SENDING
    // =========================================================================
    const resendApiKey = process.env.RESEND_API_KEY

    if (!resendApiKey) {
      logger.error("[Contact] RESEND_API_KEY is not configured")

      // For development, log the email instead of failing
      if (process.env.NODE_ENV === "development") {
        logger.log("=== Contact Form Submission (Resend not configured) ===")
        logger.log("Name:", name)
        logger.log("Email:", email)
        logger.log("Subject:", subject)
        logger.log("Message:", message)
        logger.log("=======================================================")

        return createSuccessResponse({
          success: true,
          message: "Email logged (Resend not configured in development)",
          messageId: "dev-log",
        })
      }

      return createErrorResponse(
        new Error("Email service is not configured. Please contact us directly at arcynflow@gmail.com"),
        500,
        ErrorCodes.INTERNAL_ERROR
      )
    }

    // Initialize Resend inside the handler
    const resend = new Resend(resendApiKey)

    // Double-sanitize for HTML email (already sanitized by schema, but extra safety)
    const safeName = sanitizeHtml(name)
    const safeEmail = sanitizeHtml(email)
    const safeSubject = sanitizeHtml(subject)
    const safeMessage = sanitizeHtml(message)

    // Use onresend.com domain for testing, or your verified domain
    const fromEmail = process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev"

    const { data, error } = await resend.emails.send({
      from: `Arcyn Find <${fromEmail}>`,
      to: ["arcynflow@gmail.com"],
      replyTo: email, // Original email for reply
      subject: `Contact Form: ${safeSubject}`,
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
          : "Failed to send email. Please try again or contact us directly at arcynflow@gmail.com"
      return createErrorResponse(
        new Error(errorMessage),
        500,
        ErrorCodes.INTERNAL_ERROR
      )
    }

    // Success response with rate limit headers
    const response = createSuccessResponse({
      success: true,
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
