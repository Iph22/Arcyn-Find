/**
 * Image Search Utilities
 * Uses image recognition to find similar AI tools
 */

export interface ImageSearchResult {
  toolId: string
  toolName: string
  similarity: number
  matchedFeatures: string[]
}

/**
 * Search tools by image
 * This is a placeholder implementation - in production, you'd use:
 * - Google Vision API
 * - AWS Rekognition
 * - Custom ML model
 * - Image similarity search
 */
export async function searchByImage(
  imageFile: File,
  allTools: Array<{ id: string; name: string; description: string; tags: string[] }>
): Promise<ImageSearchResult[]> {
  try {
    // Convert image to base64 for processing
    const imageData = await fileToBase64(imageFile)
    
    // Extract text from image using OCR (placeholder)
    const extractedText = await extractTextFromImage(imageData)
    
    // Search tools based on extracted text
    const results = searchToolsByText(extractedText, allTools)
    
    return results
  } catch (error) {
    console.error('Error in image search:', error)
    return []
  }
}

/**
 * Convert file to base64
 */
function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result as string
      resolve(result.split(',')[1]) // Remove data:image/...;base64, prefix
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

/**
 * Extract text from image using OCR
 * Placeholder - in production, use Tesseract.js or cloud OCR service
 */
async function extractTextFromImage(imageData: string): Promise<string> {
  // Placeholder: In production, use:
  // - Tesseract.js for client-side OCR
  // - Google Cloud Vision API
  // - AWS Textract
  // - Azure Computer Vision
  
  // For now, return empty string (would need actual OCR implementation)
  return ''
}

/**
 * Search tools based on extracted text
 */
function searchToolsByText(
  text: string,
  allTools: Array<{ id: string; name: string; description: string; tags: string[] }>
): ImageSearchResult[] {
  if (!text.trim()) return []

  const normalizedText = text.toLowerCase()
  const results: ImageSearchResult[] = []

  for (const tool of allTools) {
    let similarity = 0
    const matchedFeatures: string[] = []

    // Check name match
    if (tool.name.toLowerCase().includes(normalizedText)) {
      similarity += 50
      matchedFeatures.push('name')
    }

    // Check description match
    if (tool.description.toLowerCase().includes(normalizedText)) {
      similarity += 30
      matchedFeatures.push('description')
    }

    // Check tags match
    const matchingTags = tool.tags.filter(tag =>
      tag.toLowerCase().includes(normalizedText) ||
      normalizedText.includes(tag.toLowerCase())
    )
    if (matchingTags.length > 0) {
      similarity += matchingTags.length * 10
      matchedFeatures.push(...matchingTags)
    }

    if (similarity > 0) {
      results.push({
        toolId: tool.id,
        toolName: tool.name,
        similarity: Math.min(similarity, 100),
        matchedFeatures: [...new Set(matchedFeatures)],
      })
    }
  }

  // Sort by similarity
  results.sort((a, b) => b.similarity - a.similarity)

  return results.slice(0, 10) // Return top 10
}

/**
 * Check if image search is supported
 */
export function isImageSearchSupported(): boolean {
  return typeof FileReader !== 'undefined' && typeof File !== 'undefined'
}

/**
 * Validate image file
 */
export function validateImageFile(file: File): { valid: boolean; error?: string } {
  const maxSize = 10 * 1024 * 1024 // 10MB
  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif']

  if (!allowedTypes.includes(file.type)) {
    return {
      valid: false,
      error: 'Invalid image type. Please use JPEG, PNG, WebP, or GIF.',
    }
  }

  if (file.size > maxSize) {
    return {
      valid: false,
      error: 'Image is too large. Maximum size is 10MB.',
    }
  }

  return { valid: true }
}

