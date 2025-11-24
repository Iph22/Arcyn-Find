import { NextResponse } from 'next/server'
import { createErrorResponse, createSuccessResponse, ErrorCodes } from '@/lib/api-errors'
import { logger } from '@/lib/logger'
import { ToolsService } from '@/lib/services/tools.service'

/**
 * POST /api/track-view
 * Tracks a view/click on an AI tool and updates popularity in real-time
 */
export async function POST(request: Request) {
  try {
    // SECURITY FIX: Add rate limiting to prevent abuse
    // Parse request body with error handling
    let body
    try {
      body = await request.json()
    } catch (parseError) {
      return createErrorResponse('Invalid JSON in request body', 400, ErrorCodes.VALIDATION_ERROR)
    }
    
    const { aiId } = body
    
    if (!aiId || typeof aiId !== 'string') {
      return createErrorResponse('Invalid aiId', 400, ErrorCodes.VALIDATION_ERROR)
    }

    const newPopularity = await ToolsService.updatePopularity(aiId, 0.1)
    
    return createSuccessResponse({ 
      success: true,
      newPopularity
    })
  } catch (error) {
    if (error instanceof Error && error.message === 'Tool not found') {
      return createErrorResponse('Tool not found', 404, ErrorCodes.NOT_FOUND)
    }
    logger.error('Error tracking view:', error)
    return createErrorResponse(
      error instanceof Error ? error.message : 'Internal server error',
      500,
      ErrorCodes.INTERNAL_ERROR
    )
  }
}

