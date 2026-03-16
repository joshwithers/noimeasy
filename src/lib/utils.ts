/**
 * Replace {{key}} placeholders in a template string with values from data.
 */
export function renderTemplate(
  template: string,
  data: Record<string, unknown>
): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    const val = data[key]
    if (val === undefined || val === null) return ''
    return String(val)
  })
}

/**
 * Format a date string as "3 Oct 2024, 14:30" (AU locale).
 */
export function formatDate(dateStr: string): string {
  try {
    const d = new Date(dateStr)
    return d.toLocaleString('en-AU', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return dateStr
  }
}
