import { useState, useEffect, useCallback } from 'react'
import { supabase } from './supabase'
import { calcRawScore } from './constants'

// ── Pairs ──────────────────────────────────────────────────────────────────
export function usePairs() {
  const [pairs, setPairs] = useState([])
  const [loading, setLoading] = useState(true)

  const fetch = useCallback(async () => {
    try {
      const { data } = await supabase.from('pairs').select('*').order('id')
      if (data) setPairs(data)
    } catch(e) {}
    setLoading(false)   // always clears — even on error
  }, [])

  useEffect(() => {
    fetch()
    const ch = supabase.channel('pairs-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pairs' }, fetch)
      .subscribe()
    return () => supabase.removeChannel(ch)
  }, [fetch])

  return { pairs, loading, refetch: fetch }
}

// ── Weighins ───────────────────────────────────────────────────────────────
export function useWeighins() {
  const [weighins, setWeighins] = useState([])
  const [loading, setLoading] = useState(true)

  const fetch = useCallback(async () => {
    try {
      const { data } = await supabase.from('weighins').select('*')
      if (data) setWeighins(data)
    } catch(e) {}
    setLoading(false)   // always clears — even on error
  }, [])

  useEffect(() => {
    fetch()
    const ch = supabase.channel('weighins-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'weighins' }, fetch)
      .subscribe()
    return () => supabase.removeChannel(ch)
  }, [fetch])

  return { weighins, loading, refetch: fetch }
}

// ── Protests ───────────────────────────────────────────────────────────────
export function useProtests() {
  const [protests, setProtests] = useState([])
  const [loading, setLoading] = useState(true)

  const fetch = useCallback(async () => {
    try {
      const { data } = await supabase.from('protests').select('*').order('created_at', { ascending: false })
      if (data) setProtests(data)
    } catch(e) {}
    setLoading(false)   // always clears — even on error
  }, [])

  useEffect(() => { fetch() }, [fetch])

  return { protests, loading, refetch: fetch }
}

// ── Leaderboard calculation ────────────────────────────────────────────────
export function buildLeaderboard(pairs, weighins) {
  const byPair = {}
  for (const w of weighins) {
    if (!byPair[w.pair_id]) byPair[w.pair_id] = {}
    byPair[w.pair_id][w.day] = w
  }

  const withScores = pairs.filter(p => p.confirmed).map(p => {
    const d1 = byPair[p.id]?.[1]
    const d2 = byPair[p.id]?.[2]
    return {
      ...p,
      d1Raw: d1 ? calcRawScore(d1.fish_count, d1.total_kg) : null,
      d2Raw: d2 ? calcRawScore(d2.fish_count, d2.total_kg) : null,
      d1Data: d1 || null,
      d2Data: d2 || null,
    }
  })

  const d1Scores = withScores.map(p => p.d1Raw).filter(s => s !== null)
  const d2Scores = withScores.map(p => p.d2Raw).filter(s => s !== null)
  const d1Top = d1Scores.length > 0 ? Math.max(...d1Scores) : 0
  const d2Top = d2Scores.length > 0 ? Math.max(...d2Scores) : 0

  return withScores.map(p => {
    const d1pct = (p.d1Raw !== null && d1Top > 0)
      ? (p.d1Raw / d1Top) * 100 : null
    const d2pct = (p.d2Raw !== null && d2Top > 0)
      ? (p.d2Raw / d2Top) * 100 : null
    const total = (d1pct ?? 0) + (d2pct ?? 0)
    return { ...p, d1pct, d2pct, total }
  })
}

// ── Largest / Smallest fish across all weighins ───────────────────────────
export function specialAwards(pairs, weighins) {
  let largest = null
  let smallest = null

  for (const w of weighins) {
    const pair = pairs.find(p => p.id === w.pair_id)
    if (!pair) continue

    if (w.largest_fish_kg > 0) {
      if (!largest || w.largest_fish_kg > largest.kg) {
        largest = { kg: w.largest_fish_kg, who: w.largest_fish_who, pair, day: w.day }
      }
    }
    if (w.smallest_cat_kg > 0) {
      if (!smallest || w.smallest_cat_kg < smallest.kg) {
        smallest = { kg: w.smallest_cat_kg, who: w.smallest_cat_who, pair, day: w.day }
      }
    }
  }
  return { largest, smallest }
}
