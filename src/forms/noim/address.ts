type NominatimResult = Record<string, unknown>

const AUSTRALIAN_STATE_ABBREVIATIONS: Record<string, string> = {
  'AUSTRALIAN CAPITAL TERRITORY': 'ACT',
  ACT: 'ACT',
  'NEW SOUTH WALES': 'NSW',
  NSW: 'NSW',
  'NORTHERN TERRITORY': 'NT',
  NT: 'NT',
  QUEENSLAND: 'QLD',
  QLD: 'QLD',
  'SOUTH AUSTRALIA': 'SA',
  SA: 'SA',
  TASMANIA: 'TAS',
  TAS: 'TAS',
  VICTORIA: 'VIC',
  VIC: 'VIC',
  'WESTERN AUSTRALIA': 'WA',
  WA: 'WA',
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function firstText(...values: unknown[]): string {
  for (const value of values) {
    const candidate = text(value)
    if (candidate) return candidate
  }
  return ''
}

function australianStateAbbreviation(address: NominatimResult): string {
  const isoCode = text(address['ISO3166-2-lvl4']).toUpperCase()
  const isoMatch = isoCode.match(/^AU-(ACT|NSW|NT|QLD|SA|TAS|VIC|WA)$/)
  if (isoMatch) return isoMatch[1]

  const state = firstText(address.state, address.territory).replaceAll('.', '').toUpperCase()
  return AUSTRALIAN_STATE_ABBREVIATIONS[state] || state
}

function applySubpremise(streetLine: string, address: NominatimResult, query: string): string {
  const apiUnit = firstText(address.unit, address.flat)
  if (apiUnit) {
    const unitLabel = /^(?:unit|apartment|apt|flat)\b/i.test(apiUnit) ? apiUnit : `Unit ${apiUnit}`
    return `${unitLabel}, ${streetLine}`
  }

  const slashUnit = query.match(/^\s*([A-Za-z0-9-]+)\s*\/\s*\d/)
  if (slashUnit) return `${slashUnit[1]}/${streetLine}`

  const labelledUnit = query.match(/^\s*((?:unit|apartment|apt|flat|level)\s+[A-Za-z0-9-]+)\s*,?\s+\d/i)
  if (labelledUnit) return `${labelledUnit[1]}, ${streetLine}`

  return streetLine
}

export function addressSearchQuery(query: string): string {
  const withoutLabelledUnit = query.replace(
    /^\s*(?:unit|apartment|apt|flat|level)\s+[A-Za-z0-9-]+\s*,?\s+(?=\d)/i,
    '',
  )
  if (withoutLabelledUnit !== query) return withoutLabelledUnit.trim()

  return query.replace(/^\s*[A-Za-z0-9-]+\s*\/\s*(?=\d)/, '').trim()
}

export function formatAustralianAddress(result: unknown, query = ''): string {
  if (!result || typeof result !== 'object' || Array.isArray(result)) return ''

  const record = result as NominatimResult
  const fallback = text(record.display_name)
  if (!record.address || typeof record.address !== 'object' || Array.isArray(record.address)) return fallback

  const address = record.address as NominatimResult
  const countryCode = text(address.country_code).toLowerCase()
  const country = text(address.country).toLowerCase()
  const isoCode = text(address['ISO3166-2-lvl4']).toUpperCase()
  const isAustralian = countryCode === 'au' || country === 'australia' || isoCode.startsWith('AU-')
  if (!isAustralian) return fallback

  const streetNumber = text(address.house_number)
  const streetName = firstText(address.road, address.pedestrian, address.residential, address.path)
  const basicStreetLine = [streetNumber, streetName].filter(Boolean).join(' ')
  const locality = firstText(
    address.suburb,
    address.town,
    address.village,
    address.city,
    address.municipality,
    address.hamlet,
    address.locality,
  )
  const state = australianStateAbbreviation(address)
  const postcode = text(address.postcode)

  if (!basicStreetLine || !locality || !state || !postcode) return fallback

  const streetLine = applySubpremise(basicStreetLine, address, query)
  return `${streetLine}, ${locality.toUpperCase()} ${state} ${postcode}`
}

export function formatNominatimResults(results: unknown, query: string): NominatimResult[] {
  if (!Array.isArray(results)) return []

  const seen = new Set<string>()
  const formattedResults: NominatimResult[] = []

  for (const result of results) {
    if (!result || typeof result !== 'object' || Array.isArray(result)) continue
    const formattedName = formatAustralianAddress(result, query)
    if (!formattedName) continue

    const dedupeKey = formattedName.toLocaleLowerCase('en-AU')
    if (seen.has(dedupeKey)) continue
    seen.add(dedupeKey)
    formattedResults.push({ ...(result as NominatimResult), formatted_name: formattedName })
  }

  return formattedResults
}
