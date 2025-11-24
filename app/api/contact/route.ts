import { NextRequest } from "next/server"
import { Resend } from "resend"
import { createErrorResponse, createSuccessResponse, ErrorCodes } from "@/lib/api-errors"

// Ensure this runs on Node.js runtime (required for Resend)
export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, email, subject, message } = body

    // Validate required fields
    if (!name || !email || !subject || !message) {
      return createErrorResponse(new Error("All fields are required"), 400, ErrorCodes.VALIDATION_ERROR)
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return createErrorResponse(new Error("Invalid email format"), 400, ErrorCodes.VALIDATION_ERROR)
    }

    // Check if Resend API key is configured
    const resendApiKey = process.env.RESEND_API_KEY

    if (!resendApiKey) {
      console.error("RESEND_API_KEY is not configured")
      // For development, log the email instead of failing
      console.log("=== Contact Form Submission (Resend not configured) ===")
      console.log("Name:", name)
      console.log("Email:", email)
      console.log("Subject:", subject)
      console.log("Message:", message)
      console.log("=====================================================")

      // Return success in development, error in production
      if (process.env.NODE_ENV === "development") {
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

    // Escape HTML in user input to prevent XSS
    const escapeHtml = (text: string) => {
      const map: Record<string, string> = {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;",
      }
      return text.replace(/[&<>"']/g, (m) => map[m])
    }

    const safeName = escapeHtml(name)
    const safeEmail = escapeHtml(email)
    const safeSubject = escapeHtml(subject)
    const safeMessage = escapeHtml(message)

    // Send email using Resend
    // Use onresend.com domain for testing, or your verified domain
    const fromEmail = process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev"

    const { data, error } = await resend.emails.send({
      from: `Arcyn Find <${fromEmail}>`,
      to: ["arcynflow@gmail.com"],
      replyTo: email,
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
      console.error("Resend error:", error)
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

    return createSuccessResponse({
      success: true,
      messageId: data?.id,
    })
  } catch (error) {
    console.error("Error processing contact form:", error)
    return createErrorResponse(
      error instanceof Error ? error.message : "Failed to process request",
      500,
      ErrorCodes.INTERNAL_ERROR
    )
  }
}

