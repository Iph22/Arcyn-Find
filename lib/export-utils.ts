import type { AIEntry } from './ai-data'
import { comparisonGrid, type ComparableTool } from './compare'

/**
 * Export favorites to CSV format
 */
export function exportFavoritesToCSV(favorites: AIEntry[]): string {
  const headers = ['Name', 'Category', 'Description', 'Platform', 'Access Type', 'Pricing', 'Region', 'Tags', 'Popularity']
  
  const rows = favorites.map(ai => [
    escapeCSV(ai.name),
    escapeCSV(ai.category),
    escapeCSV(ai.description),
    escapeCSV(ai.platform),
    escapeCSV(ai.accessType),
    escapeCSV(ai.pricing),
    escapeCSV(ai.region),
    escapeCSV(ai.tags.join('; ')),
    ai.popularity.toString(),
  ])

  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.join(','))
  ].join('\n')

  return csvContent
}

/**
 * Export favorites to JSON format
 */
export function exportFavoritesToJSON(favorites: AIEntry[]): string {
  return JSON.stringify(favorites, null, 2)
}

/*
 * The comparison exports below take their rows from comparisonGrid() in
 * lib/compare.ts -- the same field list the on-screen table renders.
 *
 * They used to carry their own copies: three of them, one per format, already
 * disagreeing (`tags.join('; ')` here, `', '` in the print version,
 * `popularity` against `${popularity}%`). None of the three was reachable from
 * any page, so nothing had ever compared the file you downloaded against the
 * table you were looking at. Sharing the field list is what stops them
 * drifting again once someone adds a column.
 */

/**
 * Export comparison to CSV format
 */
export function exportComparisonToCSV(tools: ComparableTool[]): string {
  if (tools.length === 0) return ''

  return comparisonGrid(tools)
    .map(row => row.map(escapeCSV).join(','))
    .join('\n')
}

/**
 * Export comparison to JSON format
 */
export function exportComparisonToJSON(tools: ComparableTool[]): string {
  return JSON.stringify(tools, null, 2)
}

/**
 * Download file with given content and filename
 */
export function downloadFile(content: string, filename: string, mimeType: string = 'text/plain'): void {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

/**
 * Escape CSV values (handle commas, quotes, newlines)
 */
function escapeCSV(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

/**
 * Generate PDF-like comparison (using HTML and print)
 *
 * Returns false when the popup was blocked, so the caller can say so in the
 * page rather than in an `alert()` the browser may also suppress.
 */
export function exportComparisonToPDF(tools: ComparableTool[]): boolean {
  const html = generateComparisonHTML(tools)
  const printWindow = window.open('', '_blank')
  if (!printWindow) return false

  printWindow.document.write(html)
  printWindow.document.close()
  printWindow.focus()

  // Wait for content to load, then print
  setTimeout(() => {
    printWindow.print()
  }, 250)
  return true
}

function generateComparisonHTML(tools: ComparableTool[]): string {
  const [header, ...rows] = comparisonGrid(tools)

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <title>AI Tools Comparison</title>
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          padding: 20px;
          color: #333;
        }
        h1 {
          text-align: center;
          margin-bottom: 30px;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 20px;
        }
        th, td {
          border: 1px solid #ddd;
          padding: 12px;
          text-align: left;
        }
        th {
          background-color: #f5f5f5;
          font-weight: bold;
        }
        tr:nth-child(even) {
          background-color: #f9f9f9;
        }
        .feature-label {
          font-weight: 600;
          background-color: #f0f0f0;
        }
        @media print {
          body { padding: 0; }
          @page { margin: 1cm; }
        }
      </style>
    </head>
    <body>
      <h1>AI Tools Comparison</h1>
      <p>Generated on ${new Date().toLocaleString()}</p>
      <table>
        <thead>
          <tr>
            ${header.map(cell => `<th>${escapeHTML(cell)}</th>`).join('')}
          </tr>
        </thead>
        <tbody>
          ${rows.map(([label, ...cells]) => `
            <tr>
              <td class="feature-label">${escapeHTML(label)}</td>
              ${cells.map(cell => `<td>${escapeHTML(cell)}</td>`).join('')}
            </tr>
          `).join('')}
        </tbody>
      </table>
      <p style="margin-top:24px;font-size:12px;color:#666">
        Prices are the cheapest published tier, converted to a monthly figure —
        an annual plan appears here as its monthly equivalent and may require
        yearly billing. Pricing and descriptions are collected automatically
        and can be out of date. Verify on each vendor's site before buying.
      </p>
    </body>
    </html>
  `
}

function escapeHTML(text: string): string {
  const div = document.createElement('div')
  div.textContent = text
  return div.innerHTML
}

