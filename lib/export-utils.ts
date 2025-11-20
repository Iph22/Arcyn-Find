import type { AIEntry } from './ai-data'

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

/**
 * Export comparison to CSV format
 */
export function exportComparisonToCSV(tools: AIEntry[]): string {
  if (tools.length === 0) return ''

  const headers = ['Feature', ...tools.map(t => escapeCSV(t.name))]
  
  const features = [
    { label: 'Category', getValue: (ai: AIEntry) => ai.category },
    { label: 'Description', getValue: (ai: AIEntry) => ai.description },
    { label: 'Platform', getValue: (ai: AIEntry) => ai.platform },
    { label: 'Access Type', getValue: (ai: AIEntry) => ai.accessType },
    { label: 'Pricing', getValue: (ai: AIEntry) => ai.pricing },
    { label: 'Region', getValue: (ai: AIEntry) => ai.region },
    { label: 'Tags', getValue: (ai: AIEntry) => ai.tags.join('; ') },
    { label: 'Popularity', getValue: (ai: AIEntry) => ai.popularity.toString() },
    { label: 'Last Updated', getValue: (ai: AIEntry) => ai.lastUpdated },
  ]

  const rows = features.map(feature => [
    escapeCSV(feature.label),
    ...tools.map(tool => escapeCSV(feature.getValue(tool)))
  ])

  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.join(','))
  ].join('\n')

  return csvContent
}

/**
 * Export comparison to JSON format
 */
export function exportComparisonToJSON(tools: AIEntry[]): string {
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
 */
export function exportComparisonToPDF(tools: AIEntry[]): void {
  const html = generateComparisonHTML(tools)
  const printWindow = window.open('', '_blank')
  if (!printWindow) {
    alert('Please allow popups to export to PDF')
    return
  }
  
  printWindow.document.write(html)
  printWindow.document.close()
  printWindow.focus()
  
  // Wait for content to load, then print
  setTimeout(() => {
    printWindow.print()
  }, 250)
}

function generateComparisonHTML(tools: AIEntry[]): string {
  const features = [
    { label: 'Category', getValue: (ai: AIEntry) => ai.category },
    { label: 'Description', getValue: (ai: AIEntry) => ai.description },
    { label: 'Platform', getValue: (ai: AIEntry) => ai.platform },
    { label: 'Access Type', getValue: (ai: AIEntry) => ai.accessType },
    { label: 'Pricing', getValue: (ai: AIEntry) => ai.pricing },
    { label: 'Region', getValue: (ai: AIEntry) => ai.region },
    { label: 'Tags', getValue: (ai: AIEntry) => ai.tags.join(', ') },
    { label: 'Popularity', getValue: (ai: AIEntry) => `${ai.popularity}%` },
    { label: 'Last Updated', getValue: (ai: AIEntry) => ai.lastUpdated },
  ]

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
            <th>Feature</th>
            ${tools.map(t => `<th>${escapeHTML(t.name)}</th>`).join('')}
          </tr>
        </thead>
        <tbody>
          ${features.map(f => `
            <tr>
              <td class="feature-label">${escapeHTML(f.label)}</td>
              ${tools.map(t => `<td>${escapeHTML(f.getValue(t))}</td>`).join('')}
            </tr>
          `).join('')}
        </tbody>
      </table>
    </body>
    </html>
  `
}

function escapeHTML(text: string): string {
  const div = document.createElement('div')
  div.textContent = text
  return div.innerHTML
}

