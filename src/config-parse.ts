export const parseList = (v: string): string[] =>
  v ? v.split(',').map(s => s.trim()).filter(Boolean) : []

export const parseAliases = (v: string): Record<string, string> => {
  if (!v) return {}
  const map: Record<string, string> = {}
  for (const pair of v.split(',')) {
    const [alias, source] = pair.split(':').map(s => s.trim())
    if (alias && source) map[source] = alias
  }
  return map
}

export const filterArtefacts = <T extends { _id: string }>(artefacts: T[], include: string[], exclude: string[]): T[] => {
  let filtered = artefacts
  if (include.length) filtered = filtered.filter(a => include.includes(a._id))
  if (exclude.length) filtered = filtered.filter(a => !exclude.includes(a._id))
  return filtered
}
