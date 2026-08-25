const fs = require('fs')
const path = require('path')

const AI_DATA_PATH = path.join(__dirname, '../../lib/ai-data.ts')
const JSON_OUTPUT_PATH = path.join(__dirname, '../../public/ai-data.json')

// Read the TypeScript file
const content = fs.readFileSync(AI_DATA_PATH, 'utf-8')

// Extract the array content (everything between [ and ])
const arrayStart = content.indexOf('export const aiEntries: AIEntry[] = [')
if (arrayStart === -1) {
  console.error('Could not find aiEntries array')
  process.exit(1)
}

// Find the matching closing bracket
let bracketCount = 0
let inString = false
let stringChar = null
let i = arrayStart + 'export const aiEntries: AIEntry[] = ['.length

for (; i < content.length; i++) {
  const char = content[i]
  const prevChar = i > 0 ? content[i - 1] : ''
  
  // Handle string escaping
  if (prevChar !== '\\') {
    if ((char === '"' || char === "'" || char === '`') && !inString) {
      inString = true
      stringChar = char
    } else if (char === stringChar && inString) {
      inString = false
      stringChar = null
    }
  }
  
  if (!inString) {
    if (char === '[') bracketCount++
    if (char === ']') {
      if (bracketCount === 0) break
      bracketCount--
    }
  }
}

const arrayContent = content.substring(
  arrayStart + 'export const aiEntries: AIEntry[] = ['.length,
  i
)

// Convert TypeScript object syntax to JSON
// This is a simplified converter - handles basic cases
let jsonContent = arrayContent
  // Remove trailing commas before closing braces/brackets
  .replace(/,(\s*[}\]])/g, '$1')
  // Convert single quotes to double quotes (with escape handling)
  .replace(/'/g, '"')
  // Fix boolean values
  .replace(/\btrue\b/g, 'true')
  .replace(/\bfalse\b/g, 'false')
  // Remove TypeScript-specific syntax
  .replace(/:\s*undefined/g, ': null')

// Try to parse and stringify to validate and format
try {
  // Wrap in array brackets
  const jsonArray = JSON.parse('[' + jsonContent + ']')
  
  // Write to JSON file with pretty formatting
  fs.writeFileSync(JSON_OUTPUT_PATH, JSON.stringify(jsonArray, null, 2), 'utf-8')
  
  console.log(`✅ Successfully converted ${jsonArray.length} entries to JSON`)
  console.log(`📁 Output: ${JSON_OUTPUT_PATH}`)
  console.log(`📊 File size: ${(fs.statSync(JSON_OUTPUT_PATH).size / 1024 / 1024).toFixed(2)} MB`)
} catch (error) {
  console.error('❌ Error parsing/converting:', error.message)
  console.error('This is a complex conversion. Using alternative method...')
  
  // Alternative: Use eval in a safe way (only for build-time conversion)
  try {
    // Create a safe context
    const AIEntry = {}
    const entries = eval('[' + arrayContent + ']')
    
    fs.writeFileSync(JSON_OUTPUT_PATH, JSON.stringify(entries, null, 2), 'utf-8')
    
    console.log(`✅ Successfully converted ${entries.length} entries to JSON (alternative method)`)
    console.log(`📁 Output: ${JSON_OUTPUT_PATH}`)
    console.log(`📊 File size: ${(fs.statSync(JSON_OUTPUT_PATH).size / 1024 / 1024).toFixed(2)} MB`)
  } catch (evalError) {
    console.error('❌ Alternative method also failed:', evalError.message)
    console.error('Please manually convert or use a different approach')
    process.exit(1)
  }
}

