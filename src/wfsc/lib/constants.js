export const ADMIN_PASSWORD = import.meta.env.VITE_WFSC_ADMIN_PASSWORD || 'wfsc2026'

export const DIVISIONS = ['Mens', 'Womens', 'Masters', 'Junior', 'Mixed']

export const DIVISION_COLORS = {
  Mens:    '#00d4ff',
  Womens:  '#ff6eb4',
  Masters: '#ffb300',
  Junior:  '#00e5a0',
  Mixed:   '#a78bfa',
}

export const COUNTRIES = [
  { name: 'New Zealand', short: 'NZL', emoji: '🇳🇿' },
  { name: 'USA',         short: 'USA', emoji: '🇺🇸' },
  { name: 'Hawaii',      short: 'HI',  emoji: '🏴', parentCountry: 'USA' },  // Grouped under USA in Nations view
  { name: 'Australia',   short: 'AUS', emoji: '🇦🇺' },
  { name: 'Guam',        short: 'GUM', emoji: '🇬🇺' },
  { name: 'Ghana',       short: 'GHA', emoji: '🇬🇭' },
  { name: 'Singapore',   short: 'SGP', emoji: '🇸🇬' },
  { name: 'Cuba',        short: 'CUB', emoji: '🇨🇺' },
  { name: 'England',     short: 'ENG', emoji: '🏴󠁧󠁢󠁥󠁮󠁧󠁿' },
  { name: 'Portugal',    short: 'POR', emoji: '🇵🇹' },
  { name: 'China',       short: 'CHN', emoji: '🇨🇳' },
]

export const countryByName = (name) =>
  COUNTRIES.find(c => c.name === name) || { name, short: name.slice(0,3).toUpperCase(), emoji: '🏳️' }

// Scoring: 100pts per fish + 10pts per 100g (floored)
export const calcRawScore = (fishCount, totalKg) => {
  const fishPts = (fishCount || 0) * 100
  const weightPts = Math.floor((totalKg || 0) * 10)
  return fishPts + weightPts
}
