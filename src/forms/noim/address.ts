/** Shared by the review screen and server; let the PDF wrap at its actual width. */
export function formatResidentialAddress(parts: Record<string, string>): string {
  const localities = [parts.suburb, parts.city].filter((value, index, values) =>
    value && values.findIndex((other) => other?.toLowerCase() === value.toLowerCase()) === index,
  )
  return [
    parts.line1,
    parts.line2,
    ...localities,
    [parts.state, parts.postcode].filter(Boolean).join(' '),
    parts.country,
  ].filter(Boolean).join(', ')
}
