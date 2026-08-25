#!/usr/bin/env node

/**
 * Generate images for AI tools
 * Creates OG images and thumbnails for each AI tool
 */

import fs from 'fs'
import path from 'path'
// Canvas is optional - install with: npm install canvas
let createCanvas: any, loadImage: any, registerFont: any
try {
  const canvas = require('canvas')
  createCanvas = canvas.createCanvas
  loadImage = canvas.loadImage
  registerFont = canvas.registerFont
} catch (e) {
  console.warn('Canvas module not found. Image generation requires: npm install canvas')
  process.exit(1)
}
import { getSupabaseAdmin, transformToAIEntry } from '../../lib/supabase'
import type { AIEntry } from '../../lib/ai-data'

const OUTPUT_DIR = path.join(process.cwd(), 'public', 'ai-tools')
const FONT_PATH = path.join(process.cwd(), 'public', 'fonts') // You'll need to add fonts

// Ensure output directory exists
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true })
}

// Color palette for different categories
const categoryColors: Record<string, string> = {
  'Generative AI': '#6366f1',
  'Computer Vision': '#8b5cf6',
  'Code Generation': '#06b6d4',
  'Audio/NLP': '#10b981',
  'Video Generation': '#f59e0b',
  'Data Analytics': '#ef4444',
  'ML Infrastructure': '#ec4899',
  'Search/QA': '#3b82f6',
  default: '#6b7280',
}

async function generateToolImage(tool: AIEntry): Promise<void> {
  const width = 1200
  const height = 630
  const canvas = createCanvas(width, height)
  const ctx = canvas.getContext('2d')

  // Background gradient
  const bgColor = categoryColors[tool.category] || categoryColors.default
  const gradient = ctx.createLinearGradient(0, 0, width, height)
  gradient.addColorStop(0, bgColor)
  gradient.addColorStop(1, darkenColor(bgColor, 20))
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, width, height)

  // Add pattern overlay
  ctx.fillStyle = 'rgba(255, 255, 255, 0.05)'
  for (let i = 0; i < width; i += 50) {
    for (let j = 0; j < height; j += 50) {
      if ((i + j) % 100 === 0) {
        ctx.fillRect(i, j, 25, 25)
      }
    }
  }

  // Title
  ctx.fillStyle = '#ffffff'
  ctx.font = 'bold 64px Arial'
  ctx.textAlign = 'left'
  ctx.textBaseline = 'top'
  
  // Wrap text if too long
  const maxWidth = width - 120
  const titleLines = wrapText(ctx, tool.name, maxWidth, 64)
  let yPos = 80
  
  titleLines.forEach((line, index) => {
    ctx.fillText(line, 60, yPos + index * 80)
  })

  // Category badge
  const categoryY = yPos + titleLines.length * 80 + 40
  ctx.fillStyle = 'rgba(255, 255, 255, 0.2)'
  ctx.fillRect(60, categoryY, 200, 50)
  ctx.fillStyle = '#ffffff'
  ctx.font = '24px Arial'
  ctx.fillText(tool.category, 80, categoryY + 15)

  // Description (truncated)
  ctx.fillStyle = 'rgba(255, 255, 255, 0.8)'
  ctx.font = '28px Arial'
  const description = truncateText(tool.description, 100)
  const descLines = wrapText(ctx, description, maxWidth, 28)
  const descY = categoryY + 80
  descLines.slice(0, 3).forEach((line, index) => {
    ctx.fillText(line, 60, descY + index * 40)
  })

  // Tags
  if (tool.tags && tool.tags.length > 0) {
    const tagsY = descY + descLines.slice(0, 3).length * 40 + 40
    ctx.font = '20px Arial'
    tool.tags.slice(0, 3).forEach((tag, index) => {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.3)'
      const tagWidth = ctx.measureText(tag).width + 20
      ctx.fillRect(60 + index * (tagWidth + 10), tagsY, tagWidth, 35)
      ctx.fillStyle = '#ffffff'
      ctx.fillText(tag, 70 + index * (tagWidth + 10), tagsY + 10)
    })
  }

  // Save image
  const buffer = canvas.toBuffer('image/png')
  const outputPath = path.join(OUTPUT_DIR, `${tool.id}.png`)
  fs.writeFileSync(outputPath, buffer)
  
  console.log(`Generated image for ${tool.name}: ${outputPath}`)
}

function wrapText(ctx: any, text: string, maxWidth: number, fontSize: number): string[] {
  const words = text.split(' ')
  const lines: string[] = []
  let currentLine = words[0]

  for (let i = 1; i < words.length; i++) {
    const word = words[i]
    const width = ctx.measureText(currentLine + ' ' + word).width
    if (width < maxWidth) {
      currentLine += ' ' + word
    } else {
      lines.push(currentLine)
      currentLine = word
    }
  }
  lines.push(currentLine)
  return lines
}

function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text
  return text.substring(0, maxLength - 3) + '...'
}

function darkenColor(color: string, percent: number): string {
  const num = parseInt(color.replace('#', ''), 16)
  const r = Math.max(0, Math.floor((num >> 16) * (100 - percent) / 100))
  const g = Math.max(0, Math.floor(((num >> 8) & 0x00FF) * (100 - percent) / 100))
  const b = Math.max(0, Math.floor((num & 0x0000FF) * (100 - percent) / 100))
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`
}

async function main() {
  console.log('Starting AI tool image generation...\n')

  try {
    // Load AI tools from Supabase
    const supabase = getSupabaseAdmin()
    const { data, error } = await supabase
      .from('ai_tools')
      .select('*')
      .order('popularity', { ascending: false })
      .limit(1000) // Generate images for top 1000 tools

    if (error || !data) {
      console.error('Error loading AI tools:', error)
      process.exit(1)
    }

    const tools = data.map(transformToAIEntry)
    console.log(`Found ${tools.length} AI tools to process\n`)

    // Generate images
    for (let i = 0; i < tools.length; i++) {
      const tool = tools[i]
      try {
        await generateToolImage(tool)
        if ((i + 1) % 10 === 0) {
          console.log(`Progress: ${i + 1}/${tools.length} tools processed\n`)
        }
      } catch (error) {
        console.error(`Error generating image for ${tool.name}:`, error)
      }
    }

    console.log(`\n✅ Successfully generated images for ${tools.length} AI tools`)
    console.log(`Images saved to: ${OUTPUT_DIR}`)
  } catch (error) {
    console.error('Fatal error:', error)
    process.exit(1)
  }
}

// Run if called directly
if (require.main === module) {
  main()
}

export { generateToolImage }

