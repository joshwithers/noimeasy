import occupationsText from './occupations.txt'

export const OCCUPATIONS = occupationsText
  .split(/\r?\n/u)
  .map((occupation) => occupation.trim())
  .filter(Boolean)
