/**
 * Simple markdown-to-HTML converter for the landing page.
 * Handles headings, bold, paragraphs, lists, and horizontal rules.
 * No external dependencies.
 */
export function markdownToHtml(md: string): string {
  const lines = md.split('\n')
  const html: string[] = []
  let inList = false

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i]

    // Horizontal rule
    if (/^---+\s*$/.test(line)) {
      if (inList) { html.push('</ul>'); inList = false }
      html.push('<hr>')
      continue
    }

    // Headings
    const headingMatch = line.match(/^(#{1,6})\s+(.+)$/)
    if (headingMatch) {
      if (inList) { html.push('</ul>'); inList = false }
      const level = headingMatch[1].length
      html.push(`<h${level}>${inline(headingMatch[2])}</h${level}>`)
      continue
    }

    // List items
    if (/^[-*]\s+/.test(line)) {
      if (!inList) { html.push('<ul>'); inList = true }
      html.push(`<li>${inline(line.replace(/^[-*]\s+/, ''))}</li>`)
      continue
    }

    // Numbered list items
    if (/^\d+\.\s+/.test(line)) {
      // For simplicity, render as unordered
      if (!inList) { html.push('<ul>'); inList = true }
      html.push(`<li>${inline(line.replace(/^\d+\.\s+/, ''))}</li>`)
      continue
    }

    // Close list if we hit a non-list line
    if (inList) { html.push('</ul>'); inList = false }

    // Empty line = paragraph break
    if (line.trim() === '') continue

    // Paragraph
    html.push(`<p>${inline(line)}</p>`)
  }

  if (inList) html.push('</ul>')
  return html.join('\n')
}

function inline(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`(.+?)`/g, '<code>$1</code>')
}
