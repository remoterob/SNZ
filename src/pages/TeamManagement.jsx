import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { Users, Plus, Search, Edit, Trash2, Download } from 'lucide-react'

const SNZ_LOGO = import.meta.env.VITE_SNZ_LOGO_URL || '/api/placeholder/200/80'

export default function TeamManagement() {
  const navigate = useNavigate()
  const [teams, setTeams] = useState([])
  const [searchTerm, setSearchTerm] = useState('')
  const [filterDivision, setFilterDivision] = useState('All')
  const [showAddModal, setShowAddModal] = useState(false)
  const [editingTeam, setEditingTeam] = useState(null)
  const [loading, setLoading] = useState(true)
  const [importing, setImporting] = useState(false)
  const [importResults, setImportResults] = useState(null)

  const [formData, setFormData] = useState({
    team_number: '',
    is_junior: false,
    is_women: false,
    is_mixed: false,
    competitor1_name: '',
    competitor1_email: '',
    competitor2_name: '',
    competitor2_email: '',
    competitor3_name: '',
    competitor3_email: '',
    club: '',
    notes: '',
    tshirt1: '',
    tshirt1_taken: false,
    tshirt2: '',
    tshirt2_taken: false,
    tshirt3: '',
    tshirt3_taken: false,
    registered: false,
    attended_briefing: false
  })

  const fetchTeams = async () => {
    try {
      const { data, error } = await supabase
        .from('teams')
        .select('*')
        .order('team_number')

      if (error) throw error
      setTeams(data || [])
      setLoading(false)
    } catch (error) {
      console.error('Error fetching teams:', error)
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchTeams()
  }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    try {
      if (editingTeam) {
        const { error } = await supabase
          .from('teams')
          .update(formData)
          .eq('id', editingTeam.id)

        if (error) throw error
      } else {
        const { error } = await supabase
          .from('teams')
          .insert([formData])

        if (error) throw error
      }

      fetchTeams()
      setShowAddModal(false)
      setEditingTeam(null)
      resetForm()
    } catch (error) {
      console.error('Error saving team:', error)
      alert('Error saving team: ' + error.message)
    }
  }

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this team?')) return

    try {
      const { error } = await supabase
        .from('teams')
        .delete()
        .eq('id', id)

      if (error) throw error
      fetchTeams()
    } catch (error) {
      console.error('Error deleting team:', error)
      alert('Error deleting team: ' + error.message)
    }
  }

  const resetForm = () => {
    setFormData({
      team_number: '',
      is_junior: false,
      is_women: false,
      is_mixed: false,
      competitor1_name: '',
      competitor1_email: '',
      competitor2_name: '',
      competitor2_email: '',
      competitor3_name: '',
      competitor3_email: '',
      club: '',
      notes: '',
      tshirt1: '',
      tshirt1_taken: false,
      tshirt2: '',
      tshirt2_taken: false,
      tshirt3: '',
      tshirt3_taken: false,
      registered: false,
      attended_briefing: false
    })
  }

  // Inline-update a single boolean field without opening the modal
  const handleInlineToggle = async (teamId, field, currentValue) => {
    try {
      const { error } = await supabase
        .from('teams')
        .update({ [field]: !currentValue })
        .eq('id', teamId)
      if (error) throw error
      setTeams(prev => prev.map(t => t.id === teamId ? { ...t, [field]: !currentValue } : t))
    } catch (err) {
      console.error('Inline update error:', err)
      alert('Failed to update: ' + err.message)
    }
  }

  const startEdit = (team) => {
    setFormData(team)
    setEditingTeam(team)
    setShowAddModal(true)
  }

  // ── TryBooking Import ──────────────────────────────────────────────
  const [importPreview, setImportPreview] = useState(null) // parsed teams awaiting review

  const TSHIRT_COL = "Ticket Data: T Shirt Size (we Have Purchased A Few Spares For Late Bookings After 8th Of Feb But Sorry We Cannot Guarantee A Tshirt For Late Entries))"
  const DIVISION_COL = "Ticket Data: Divisions You Are Entering."
  const PARTNER_COL = "Ticket Data: Dive Partner"
  const FNAME_COL = "Ticket Data: Competitor First Name"
  const LNAME_COL = "Ticket Data: Competitor Last Name"
  const EMAIL_COL = "Ticket Data: Competitors Email"
  const TICKET_TYPE_COL = "Ticket Type"
  const BOOKING_ID_COL = "Booking ID"

  // Robust CSV parser that handles quoted fields with commas inside
  const parseCSVRobust = (text) => {
    const lines = []
    let current = []
    let field = ''
    let inQuotes = false
    // strip BOM
    const raw = text.replace(/^\uFEFF/, '')
    for (let i = 0; i < raw.length; i++) {
      const ch = raw[i]
      const next = raw[i + 1]
      if (inQuotes) {
        if (ch === '"' && next === '"') { field += '"'; i++ }
        else if (ch === '"') { inQuotes = false }
        else { field += ch }
      } else {
        if (ch === '"') { inQuotes = true }
        else if (ch === ',') { current.push(field.trim()); field = '' }
        else if (ch === '\n' || (ch === '\r' && next === '\n')) {
          if (ch === '\r') i++
          current.push(field.trim()); field = ''
          if (current.some(v => v)) lines.push(current)
          current = []
        } else { field += ch }
      }
    }
    if (field || current.length) { current.push(field.trim()); if (current.some(v => v)) lines.push(current) }
    if (lines.length < 2) return []
    const headers = lines[0]
    return lines.slice(1).map(values => {
      const row = {}
      headers.forEach((h, i) => { row[h] = values[i] || '' })
      return row
    })
  }

  const normalizeName = (name) =>
    name.trim().replace(/\s+/g, ' ')
      .split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ')

  // Fuzzy name match: exact → first-last swap → single word contained
  const findCompetitor = (partnerRaw, byName) => {
    const key = normalizeName(partnerRaw).toLowerCase()
    if (!key) return null
    // exact
    if (byName[key]) return byName[key]
    // try words — match if 2+ words overlap with a registered name
    const queryWords = key.split(' ').filter(w => w.length > 1)
    for (const [regKey, regRow] of Object.entries(byName)) {
      const regWords = regKey.split(' ')
      const overlap = queryWords.filter(w => regWords.includes(w))
      if (overlap.length >= 2) return regRow
      // single distinctive surname match when query is just one token
      if (queryWords.length === 1 && regWords.includes(queryWords[0])) return regRow
    }
    return null
  }

  const parseDivisions = (divStr, ticketType) => {
    const isJuniorTicket = ticketType.includes('Junior')
    const isJuniorDiv = divStr.includes('Juniors') || isJuniorTicket
    const isWomenDiv = divStr.includes('Women')
    return { isJunior: isJuniorDiv, isWomen: isWomenDiv }
  }

  const handleTryBookingImport = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    setImporting(true)
    setImportResults(null)
    setImportPreview(null)

    try {
      const text = await file.text()
      const rows = parseCSVRobust(text)

      if (!rows.length || !rows[0][FNAME_COL]) {
        // Fall back to legacy CSV format
        handleLegacyCSVRows(rows, e)
        return
      }

      // Build lookup by normalised full name
      const byName = {}
      for (const row of rows) {
        const name = normalizeName(`${row[FNAME_COL]} ${row[LNAME_COL]}`).toLowerCase()
        byName[name] = row
      }

      const matched = new Set()
      const teams = []

      for (const row of rows) {
        const name = normalizeName(`${row[FNAME_COL]} ${row[LNAME_COL]}`)
        const nameKey = name.toLowerCase()
        if (matched.has(nameKey)) continue

        const partnerRaw = row[PARTNER_COL] || ''
        const partnerRow = findCompetitor(partnerRaw, byName)
        const partnerName = partnerRow
          ? normalizeName(`${partnerRow[FNAME_COL]} ${partnerRow[LNAME_COL]}`)
          : normalizeName(partnerRaw)

        const { isJunior: c1Junior, isWomen: c1Women } = parseDivisions(row[DIVISION_COL] || '', row[TICKET_TYPE_COL] || '')
        let isJunior = c1Junior
        let isWomen = c1Women

        let c2Email = '', c2Tshirt = '', c2Junior = false
        if (partnerRow) {
          const { isJunior: pj, isWomen: pw } = parseDivisions(partnerRow[DIVISION_COL] || '', partnerRow[TICKET_TYPE_COL] || '')
          if (pj) isJunior = true
          if (pw) isWomen = true
          c2Email = partnerRow[EMAIL_COL] || ''
          c2Tshirt = partnerRow[TSHIRT_COL] || ''
          c2Junior = pj
          matched.add(partnerName.toLowerCase())
        }
        matched.add(nameKey)

        teams.push({
          // competitors
          competitor1_name: name,
          competitor1_email: row[EMAIL_COL] || '',
          competitor1_tshirt: row[TSHIRT_COL] || '',
          competitor2_name: partnerRow ? partnerName : '',   // blank if not matched
          competitor2_email: c2Email,
          competitor2_tshirt: c2Tshirt,
          // flags
          is_junior: isJunior,
          is_women: isWomen,
          // status
          partnerFound: !!partnerRow,
          partnerRaw,
          bookingId: row[BOOKING_ID_COL] || '',
          // editable team number (user assigns)
          team_number: '',
          // include all — unmatched import as Incomplete with note
          include: true,
        })
      }

      // Sort: matched first, then unmatched
      teams.sort((a, b) => (b.partnerFound ? 1 : 0) - (a.partnerFound ? 1 : 0))

      // Auto-assign team numbers from 1 for ALL teams (matched first, then unmatched)
      let nextNum = 1
      const numbered = teams.map(t => ({
        ...t,
        team_number: String(nextNum++),
        include: true, // all entries included by default
      }))

      setImportPreview(numbered)
    } catch (err) {
      alert('Error reading file: ' + err.message)
    } finally {
      setImporting(false)
      e.target.value = ''
    }
  }

  const handleLegacyCSVRows = async (rows, e) => {
    let imported = 0
    const errors = []
    for (const row of rows) {
      try {
        const isJunior = row['Is Junior']?.toLowerCase() === 'true' || row['Is Junior']?.toLowerCase() === 'yes' || row['Division']?.toLowerCase() === 'juniors'
        const isWomen  = row['Is Women']?.toLowerCase() === 'true'  || row['Is Women']?.toLowerCase() === 'yes'  || row['Division']?.toLowerCase() === 'women'
        const teamData = {
          team_number: parseInt(row['Team Number']) || 0,
          is_junior: isJunior, is_women: isWomen,
          competitor1_name: row['Competitor 1 Name'] || '', competitor1_email: row['Competitor 1 Email'] || '',
          competitor2_name: row['Competitor 2 Name'] || '', competitor2_email: row['Competitor 2 Email'] || '',
          competitor3_name: row['Competitor 3 Name'] || '', competitor3_email: row['Competitor 3 Email'] || '',
          club: row['Club'] || '', notes: row['Notes'] || ''
        }
        if (!teamData.team_number || !teamData.competitor1_name || !teamData.competitor2_name) {
          errors.push(`Row ${imported + 1}: Missing required fields`); continue
        }
        const { error } = await supabase.from('teams').insert([teamData])
        if (error) errors.push(`Team ${teamData.team_number}: ${error.message}`)
        else imported++
      } catch (err) { errors.push(`Row ${imported + 1}: ${err.message}`) }
    }
    setImportResults({ total: rows.length, imported, errors })
    fetchTeams()
    setImporting(false)
    if (e?.target) e.target.value = ''
  }

  const commitImport = async () => {
    if (!importPreview) return
    setImporting(true)
    let imported = 0
    const errors = []

    const toImport = importPreview.filter(t => t.include)

    // Validate all have team numbers
    const missingNumbers = toImport.filter(t => !t.team_number || isNaN(parseInt(t.team_number)))
    if (missingNumbers.length) {
      alert(`Please assign team numbers to all ${missingNumbers.length} included teams before importing.`)
      setImporting(false)
      return
    }

    for (const team of toImport) {
      try {
        const teamData = {
          team_number: parseInt(team.team_number),
          is_junior: team.is_junior,
          is_women: team.is_women,
          competitor1_name: team.competitor1_name,
          competitor1_email: team.competitor1_email || '',
          tshirt1: team.competitor1_tshirt || '',
          competitor2_name: team.competitor2_name || '',
          competitor2_email: team.competitor2_email || '',
          tshirt2: team.competitor2_tshirt || '',
          notes: (!team.partnerFound && team.partnerRaw)
            ? `Specified partner: ${team.partnerRaw} (not registered)`
            : '',
          registered: false,
        }
        const { error } = await supabase.from('teams').insert([teamData])
        if (error) errors.push(`Team ${team.team_number} (${team.competitor1_name}): ${error.message}`)
        else imported++
      } catch (err) { errors.push(`${team.competitor1_name}: ${err.message}`) }
    }

    setImportResults({ total: toImport.length, imported, errors })
    setImportPreview(null)
    fetchTeams()
    setImporting(false)
  }

  // Keep old handler name pointing to new one for the file input
  const handleCSVImport = handleTryBookingImport

  // Download unmatched/problem entries as a CSV for offline review
  const downloadUnmatched = () => {
    if (!importPreview) return
    const problems = importPreview.filter(t => !t.partnerFound)
    if (!problems.length) return

    const headers = ['Competitor 1 Name', 'Competitor 1 Email', 'Competitor 1 T-Shirt', 'Partner Name Entered', 'Is Junior', 'Is Women', 'Booking ID']
    const escape = v => `"${String(v || '').replace(/"/g, '""')}"`
    const rows = problems.map(t => [
      escape(t.competitor1_name),
      escape(t.competitor1_email),
      escape(t.competitor1_tshirt),
      escape(t.partnerRaw),
      escape(t.is_junior ? 'Yes' : 'No'),
      escape(t.is_women ? 'Yes' : 'No'),
      escape(t.bookingId),
    ].join(','))

    const csv = [headers.join(','), ...rows].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `unmatched-competitors-${new Date().toISOString().slice(0,10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const exportAllTeams = () => {
    if (!teams.length) return

    // Use exact TryBooking column names so the file re-imports cleanly.
    // One row per competitor (2 rows per complete team, 1 for incomplete).
    // Extra columns at the end are ignored by the importer.
    const TSHIRT_HEADER = "Ticket Data: T Shirt Size (we Have Purchased A Few Spares For Late Bookings After 8th Of Feb But Sorry We Cannot Guarantee A Tshirt For Late Entries))"
    const headers = [
      'Ticket Data: Competitor First Name',
      'Ticket Data: Competitor Last Name',
      'Ticket Data: Competitors Email',
      'Ticket Data: Dive Partner',
      TSHIRT_HEADER,
      'Ticket Data: Divisions You Are Entering.',
      'Ticket Type',
      'Booking ID',
      // Extra columns (ignored on re-import, useful for admin)
      'Team Number',
      'Club',
      'Notes',
      'Registered',
      'Attended Briefing',
    ]

    const esc = v => `"${String(v ?? '').replace(/"/g, '""')}"`

    const divisionStr = (isJunior, isWomen, isMixed) => {
      if (isJunior && isWomen) return 'Women;Juniors'
      if (isJunior) return 'Juniors'
      if (isWomen) return 'Women'
      if (isMixed) return 'Mixed'
      return ''
    }

    const ticketType = (isJunior) => isJunior ? 'One Junior Under 18' : 'One Adult'

    const splitName = (fullName) => {
      const parts = (fullName || '').trim().split(' ')
      const last = parts.length > 1 ? parts.pop() : ''
      return { first: parts.join(' '), last }
    }

    const csvRows = []
    for (const team of teams) {
      const c1 = splitName(team.competitor1_name)
      const c2 = splitName(team.competitor2_name)
      const divStr = divisionStr(team.is_junior, team.is_women, team.is_mixed)
      const extra = [
        esc(team.team_number),
        esc(team.club || ''),
        esc(team.notes || ''),
        esc(team.registered ? 'Yes' : 'No'),
        esc(team.attended_briefing ? 'Yes' : 'No'),
      ]

      // Competitor 1 row — partner field points to competitor 2
      csvRows.push([
        esc(c1.first), esc(c1.last),
        esc(team.competitor1_email || ''),
        esc(team.competitor2_name || ''),   // dive partner = c2 name
        esc(team.tshirt1 || ''),
        esc(divStr),
        esc(ticketType(team.is_junior)),
        esc(team.id || ''),
        ...extra,
      ].join(','))

      // Competitor 2 row — only if they exist
      if (team.competitor2_name) {
        csvRows.push([
          esc(c2.first), esc(c2.last),
          esc(team.competitor2_email || ''),
          esc(team.competitor1_name || ''),  // dive partner = c1 name
          esc(team.tshirt2 || ''),
          esc(divStr),
          esc(ticketType(team.is_junior)),
          esc(team.id || ''),
          ...extra,
        ].join(','))
      }
    }

    const csv = [headers.map(h => `"${h}"`).join(','), ...csvRows].join('\n')
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `teams-export-${new Date().toISOString().slice(0,10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const filteredTeams = teams
    .filter(t => {
      if (filterDivision === 'All') return true
      if (filterDivision === 'Juniors') return t.is_junior
      if (filterDivision === 'Women') return t.is_women
      if (filterDivision === 'Mixed') return t.is_mixed
      return true
    })
    .filter(t => 
      searchTerm === '' ||
      t.team_number.toString().includes(searchTerm) ||
      (t.competitor1_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (t.competitor2_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (t.competitor3_name || '').toLowerCase().includes(searchTerm.toLowerCase())
    )

  if (loading) {
    return <div className="p-8 text-center">Loading teams...</div>
  }

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <div className="flex justify-between items-center mb-4">
            <div className="flex items-center gap-4">
              <img src={SNZ_LOGO} alt="Spearfishing New Zealand" className="h-12 object-contain" />
              <div>
                <h1 className="text-3xl font-bold text-gray-900">Team Management</h1>
                <p className="text-gray-600">Manage registrations, pairs, and divisions</p>
              </div>
            </div>
            <button
              onClick={() => navigate('/admin')}
              className="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700"
            >
              Back to Dashboard
            </button>
          </div>

          <div className="flex gap-4 flex-wrap">
            <div className="flex-1 min-w-64">
              <div className="relative">
                <Search className="absolute left-3 top-3 text-gray-400 w-5 h-5" />
                <input
                  type="text"
                  placeholder="Search teams..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <select
              value={filterDivision}
              onChange={(e) => setFilterDivision(e.target.value)}
              className="px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option>All</option>
              <option>Women</option>
              <option>Juniors</option>
              <option>Mixed</option>
            </select>

            {/* CSV Import Button */}
            <div className="relative">
              <input
                type="file"
                accept=".csv"
                onChange={handleCSVImport}
                className="hidden"
                id="csv-import"
                disabled={importing}
              />
              <label
                htmlFor="csv-import"
                className={`bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700 flex items-center gap-2 cursor-pointer ${
                  importing ? 'opacity-50 cursor-not-allowed' : ''
                }`}
              >
                <Users className="w-5 h-5" />
                {importing ? 'Importing...' : 'Import TryBooking CSV'}
              </label>
            </div>

            <button
              onClick={exportAllTeams}
              disabled={teams.length === 0}
              className="bg-gray-600 text-white px-6 py-2 rounded-lg hover:bg-gray-700 flex items-center gap-2 disabled:opacity-40"
              title="Export all teams as a CSV that can be re-imported"
            >
              <Download className="w-5 h-5" />
              Export Teams CSV
            </button>

            <button
              onClick={() => {
                resetForm()
                setEditingTeam(null)
                setShowAddModal(true)
              }}
              className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 flex items-center gap-2"
            >
              <Plus className="w-5 h-5" />
              Add Team
            </button>
          </div>

          {/* Import Results */}
          {importResults && (
            <div className={`mt-4 p-4 rounded-lg border-2 ${
              importResults.errors.length > 0 ? 'bg-yellow-50 border-yellow-200' : 'bg-green-50 border-green-200'
            }`}>
              <h3 className="font-bold mb-2">
                Import Complete: {importResults.imported} of {importResults.total} teams imported
              </h3>
              {importResults.errors.length > 0 && (
                <div className="mt-2">
                  <p className="font-semibold text-red-700 mb-1">Errors:</p>
                  <ul className="text-sm text-red-600 space-y-1">
                    {importResults.errors.slice(0, 10).map((err, i) => (
                      <li key={i}>• {err}</li>
                    ))}
                    {importResults.errors.length > 10 && (
                      <li className="text-gray-600">... and {importResults.errors.length - 10} more errors</li>
                    )}
                  </ul>
                </div>
              )}
              <button
                onClick={() => setImportResults(null)}
                className="mt-2 text-sm text-blue-600 hover:underline"
              >
                Dismiss
              </button>
            </div>
          )}

          {/* Import info */}
          <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm text-blue-800">
              <strong>TryBooking export supported.</strong>{' '}
              Export a Custom Report from TryBooking and import it directly — pairs are matched automatically by dive partner name. You'll get a preview to assign team numbers and fix any unmatched pairs before committing.
            </p>
          </div>
        </div>

        {/* Mobile-friendly scrollable table wrapper */}
        <div className="bg-white rounded-lg shadow-lg overflow-hidden">
          {/* Desktop: Table view */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left whitespace-nowrap">Team #</th>
                  <th className="px-4 py-3 text-left whitespace-nowrap">Division</th>
                  <th className="px-4 py-3 text-left whitespace-nowrap">Competitors</th>
                  <th className="px-4 py-3 text-left whitespace-nowrap">Club</th>
                  <th className="px-3 py-3 text-center whitespace-nowrap">Reg'd</th>
                  <th className="px-3 py-3 text-center whitespace-nowrap">Briefing</th>
                  <th className="px-3 py-3 text-left whitespace-nowrap">T-Shirts</th>
                  <th className="px-4 py-3 text-left whitespace-nowrap">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredTeams.map((team) => (
                  <tr key={team.id} className="border-b hover:bg-gray-50">
                    <td className="px-4 py-3 font-bold whitespace-nowrap">#{team.team_number}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex flex-wrap gap-1">
                        <span className="inline-block px-2 py-1 text-xs rounded bg-blue-100 text-blue-800">
                          Open
                        </span>
                        {team.is_junior && (
                          <span className="inline-block px-2 py-1 text-xs rounded bg-purple-100 text-purple-800">
                            Juniors
                          </span>
                        )}
                        {team.is_women && (
                          <span className="inline-block px-2 py-1 text-xs rounded bg-pink-100 text-pink-800">
                            Women
                          </span>
                        )}
                        {team.is_mixed && (
                          <span className="inline-block px-2 py-1 text-xs rounded bg-orange-100 text-orange-800">
                            Mixed
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-sm">
                        {!team.competitor2_name ? (
                          <div className="flex items-center gap-2">
                            <span>{team.competitor1_name}</span>
                            <span className="inline-block px-2 py-0.5 text-xs rounded-full bg-orange-100 text-orange-700 font-semibold border border-orange-300">
                              Incomplete
                            </span>
                          </div>
                        ) : (
                          <div>{team.competitor1_name} &amp; {team.competitor2_name}</div>
                        )}
                        {team.competitor3_name && (
                          <div className="text-gray-500">+ {team.competitor3_name}</div>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">{team.club || '-'}</td>
                    {/* Registered */}
                    <td className="px-3 py-3 text-center">
                      <input
                        type="checkbox"
                        checked={!!team.registered}
                        onChange={() => handleInlineToggle(team.id, 'registered', !!team.registered)}
                        className="w-5 h-5 rounded cursor-pointer accent-green-600"
                        title="Registered"
                      />
                    </td>
                    {/* Attended Briefing */}
                    <td className="px-3 py-3 text-center">
                      <input
                        type="checkbox"
                        checked={!!team.attended_briefing}
                        onChange={() => handleInlineToggle(team.id, 'attended_briefing', !!team.attended_briefing)}
                        className="w-5 h-5 rounded cursor-pointer accent-blue-600"
                        title="Attended Briefing"
                      />
                    </td>
                    {/* T-Shirts */}
                    <td className="px-3 py-3">
                      <div className="space-y-1 min-w-[160px]">
                        {[
                          { size: team.tshirt1, takenField: 'tshirt1_taken', taken: team.tshirt1_taken },
                          { size: team.tshirt2, takenField: 'tshirt2_taken', taken: team.tshirt2_taken },
                          { size: team.tshirt3, takenField: 'tshirt3_taken', taken: team.tshirt3_taken },
                        ].filter(t => t.size).map((t, i) => (
                          <div key={i} className="flex items-center gap-1.5">
                            <input
                              type="checkbox"
                              checked={!!t.taken}
                              onChange={() => handleInlineToggle(team.id, t.takenField, !!t.taken)}
                              className="w-4 h-4 rounded cursor-pointer accent-orange-500 flex-shrink-0"
                              title={t.taken ? 'Collected' : 'Not yet collected'}
                            />
                            <span className={`text-xs ${t.taken ? 'line-through text-gray-400' : 'text-gray-700'}`}>
                              {t.size}
                            </span>
                          </div>
                        ))}
                        {!team.tshirt1 && !team.tshirt2 && !team.tshirt3 && (
                          <span className="text-xs text-gray-400">—</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex gap-2">
                        <button
                          onClick={() => startEdit(team)}
                          className="text-blue-600 hover:text-blue-800"
                        >
                          <Edit className="w-5 h-5" />
                        </button>
                        <button
                          onClick={() => handleDelete(team.id)}
                          className="text-red-600 hover:text-red-800"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filteredTeams.length === 0 && (
                  <tr>
                    <td colSpan="5" className="px-4 py-8 text-center text-gray-500">
                      No teams found. Click "Add Team" to create one.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile: Card view */}
          <div className="md:hidden">
            {filteredTeams.length === 0 ? (
              <div className="px-4 py-8 text-center text-gray-500">
                No teams found. Click "Add Team" to create one.
              </div>
            ) : (
              <div className="divide-y">
                {filteredTeams.map((team) => (
                  <div key={team.id} className="p-4 hover:bg-gray-50">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <div className="font-bold text-lg">Team #{team.team_number}</div>
                        <div className="flex flex-wrap gap-1 mt-1">
                          <span className="inline-block px-2 py-1 text-xs rounded bg-blue-100 text-blue-800">
                            Open
                          </span>
                          {team.is_junior && (
                            <span className="inline-block px-2 py-1 text-xs rounded bg-purple-100 text-purple-800">
                              Juniors
                            </span>
                          )}
                          {team.is_women && (
                            <span className="inline-block px-2 py-1 text-xs rounded bg-pink-100 text-pink-800">
                              Women
                            </span>
                          )}
                          {team.is_mixed && (
                            <span className="inline-block px-2 py-1 text-xs rounded bg-orange-100 text-orange-800">
                              Mixed
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => startEdit(team)}
                          className="text-blue-600 hover:text-blue-800 p-2"
                        >
                          <Edit className="w-5 h-5" />
                        </button>
                        <button
                          onClick={() => handleDelete(team.id)}
                          className="text-red-600 hover:text-red-800 p-2"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </div>
                    </div>
                    <div className="text-sm space-y-1">
                      {!team.competitor2_name ? (
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{team.competitor1_name}</span>
                          <span className="inline-block px-2 py-0.5 text-xs rounded-full bg-orange-100 text-orange-700 font-semibold border border-orange-300">
                            Incomplete
                          </span>
                        </div>
                      ) : (
                        <div>{team.competitor1_name} &amp; {team.competitor2_name}</div>
                      )}
                      {team.competitor3_name && (
                        <div className="text-gray-500">+ {team.competitor3_name}</div>
                      )}
                      {team.club && (
                        <div className="text-gray-500 mt-2">📍 {team.club}</div>
                      )}
                      {/* Inline status row */}
                      <div className="flex flex-wrap gap-3 mt-2 pt-2 border-t border-gray-100">
                        <label className="flex items-center gap-1.5 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={!!team.registered}
                            onChange={() => handleInlineToggle(team.id, 'registered', !!team.registered)}
                            className="w-4 h-4 rounded accent-green-600"
                          />
                          <span className="text-xs text-gray-600">Registered</span>
                        </label>
                        <label className="flex items-center gap-1.5 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={!!team.attended_briefing}
                            onChange={() => handleInlineToggle(team.id, 'attended_briefing', !!team.attended_briefing)}
                            className="w-4 h-4 rounded accent-blue-600"
                          />
                          <span className="text-xs text-gray-600">Briefing</span>
                        </label>
                      </div>
                      {/* T-shirt collected status */}
                      {(team.tshirt1 || team.tshirt2 || team.tshirt3) && (
                        <div className="flex flex-wrap gap-2 mt-1">
                          {[
                            { size: team.tshirt1, takenField: 'tshirt1_taken', taken: team.tshirt1_taken },
                            { size: team.tshirt2, takenField: 'tshirt2_taken', taken: team.tshirt2_taken },
                            { size: team.tshirt3, takenField: 'tshirt3_taken', taken: team.tshirt3_taken },
                          ].filter(t => t.size).map((t, i) => (
                            <label key={i} className="flex items-center gap-1 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={!!t.taken}
                                onChange={() => handleInlineToggle(team.id, t.takenField, !!t.taken)}
                                className="w-4 h-4 rounded accent-orange-500"
                              />
                              <span className={`text-xs ${t.taken ? 'line-through text-gray-400' : 'text-gray-600'}`}>
                                👕 {t.size}
                              </span>
                            </label>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Add/Edit Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6">
            <h2 className="text-2xl font-bold mb-4">
              {editingTeam ? 'Edit Team' : 'Add New Team'}
            </h2>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold mb-1">Team Number *</label>
                  <input
                    type="number"
                    required
                    value={formData.team_number}
                    onChange={(e) => setFormData({...formData, team_number: parseInt(e.target.value)})}
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold mb-2">Categories</label>
                  <div className="space-y-2">
                    <div className="text-sm text-gray-600 mb-2">
                      ✓ All teams compete in <strong>Open</strong>
                    </div>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.is_junior}
                        onChange={(e) => setFormData({...formData, is_junior: e.target.checked})}
                        className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                      />
                      <span className="text-sm">Also compete in Juniors</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.is_women}
                        onChange={(e) => setFormData({...formData, is_women: e.target.checked})}
                        className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                      />
                      <span className="text-sm">Also compete in Women</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.is_mixed}
                        onChange={(e) => setFormData({...formData, is_mixed: e.target.checked})}
                        className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                      />
                      <span className="text-sm">Also compete in Mixed</span>
                    </label>
                  </div>
                </div>
              </div>

              <div className="border-t pt-4">
                <h3 className="font-semibold mb-2">Competitor 1 *</h3>
                <div className="grid md:grid-cols-2 gap-4">
                  <input
                    type="text"
                    required
                    placeholder="Full Name"
                    value={formData.competitor1_name}
                    onChange={(e) => setFormData({...formData, competitor1_name: e.target.value})}
                    className="px-3 py-2 border rounded-lg"
                  />
                  <input
                    type="email"
                    required
                    placeholder="Email"
                    value={formData.competitor1_email}
                    onChange={(e) => setFormData({...formData, competitor1_email: e.target.value})}
                    className="px-3 py-2 border rounded-lg"
                  />
                </div>
              </div>

              <div className="border-t pt-4">
                <h3 className="font-semibold mb-2 flex items-center gap-2">
                  Competitor 2
                  <span className="text-xs font-normal text-gray-500">(optional — leave blank to save as Incomplete)</span>
                </h3>
                <div className="grid md:grid-cols-2 gap-4">
                  <input
                    type="text"
                    placeholder="Full Name"
                    value={formData.competitor2_name}
                    onChange={(e) => setFormData({...formData, competitor2_name: e.target.value})}
                    className="px-3 py-2 border rounded-lg"
                  />
                  <input
                    type="email"
                    placeholder="Email"
                    value={formData.competitor2_email}
                    onChange={(e) => setFormData({...formData, competitor2_email: e.target.value})}
                    className="px-3 py-2 border rounded-lg"
                  />
                </div>
              </div>

              <div className="border-t pt-4">
                <h3 className="font-semibold mb-2">Competitor 3 (Optional)</h3>
                <div className="grid md:grid-cols-2 gap-4">
                  <input
                    type="text"
                    placeholder="Full Name"
                    value={formData.competitor3_name}
                    onChange={(e) => setFormData({...formData, competitor3_name: e.target.value})}
                    className="px-3 py-2 border rounded-lg"
                  />
                  <input
                    type="email"
                    placeholder="Email"
                    value={formData.competitor3_email}
                    onChange={(e) => setFormData({...formData, competitor3_email: e.target.value})}
                    className="px-3 py-2 border rounded-lg"
                  />
                </div>
                <p className="text-sm text-gray-500 mt-1">
                  Note: 3-person teams are not eligible for prizes
                </p>
              </div>

              <div>
                <label className="block text-sm font-semibold mb-1">Club</label>
                <input
                  type="text"
                  placeholder="Optional"
                  value={formData.club}
                  onChange={(e) => setFormData({...formData, club: e.target.value})}
                  className="w-full px-3 py-2 border rounded-lg"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold mb-1">Notes</label>
                <textarea
                  placeholder="Optional notes"
                  value={formData.notes}
                  onChange={(e) => setFormData({...formData, notes: e.target.value})}
                  className="w-full px-3 py-2 border rounded-lg"
                  rows="2"
                />
              </div>

              {/* Registration & Briefing */}
              <div className="border-t pt-4">
                <h3 className="font-semibold mb-3">Event Check-in</h3>
                <div className="flex flex-wrap gap-6">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={!!formData.registered}
                      onChange={(e) => setFormData({...formData, registered: e.target.checked})}
                      className="w-5 h-5 rounded accent-green-600"
                    />
                    <span className="text-sm font-medium">Registered</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={!!formData.attended_briefing}
                      onChange={(e) => setFormData({...formData, attended_briefing: e.target.checked})}
                      className="w-5 h-5 rounded accent-blue-600"
                    />
                    <span className="text-sm font-medium">Attended Briefing</span>
                  </label>
                </div>
              </div>

              {/* T-Shirts */}
              <div className="border-t pt-4">
                <h3 className="font-semibold mb-3">T-Shirts</h3>
                <div className="space-y-3">
                  {[
                    { label: 'T-Shirt 1', sizeField: 'tshirt1', takenField: 'tshirt1_taken' },
                    { label: 'T-Shirt 2', sizeField: 'tshirt2', takenField: 'tshirt2_taken' },
                    { label: 'T-Shirt 3', sizeField: 'tshirt3', takenField: 'tshirt3_taken' },
                  ].map(({ label, sizeField, takenField }) => (
                    <div key={sizeField} className="flex items-center gap-3">
                      <label className="text-sm text-gray-600 w-20 flex-shrink-0">{label}</label>
                      <input
                        type="text"
                        placeholder="e.g. L, XL, 2XL"
                        value={formData[sizeField] || ''}
                        onChange={(e) => setFormData({...formData, [sizeField]: e.target.value})}
                        className="flex-1 px-3 py-1.5 border rounded-lg text-sm"
                      />
                      <label className="flex items-center gap-1.5 cursor-pointer flex-shrink-0">
                        <input
                          type="checkbox"
                          checked={!!formData[takenField]}
                          onChange={(e) => setFormData({...formData, [takenField]: e.target.checked})}
                          className="w-4 h-4 rounded accent-orange-500"
                        />
                        <span className="text-sm text-gray-600">Taken</span>
                      </label>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex gap-4 pt-4">
                <button
                  type="submit"
                  className="flex-1 bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700"
                >
                  {editingTeam ? 'Update Team' : 'Add Team'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowAddModal(false)
                    setEditingTeam(null)
                    resetForm()
                  }}
                  className="flex-1 bg-gray-200 text-gray-700 py-2 rounded-lg hover:bg-gray-300"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── TryBooking Import Preview Modal ─────────────────────────── */}
      {importPreview && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-start justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-5xl my-6">
            {/* Header */}
            <div className="bg-blue-700 text-white px-6 py-4 rounded-t-xl flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold">TryBooking Import Preview</h2>
                <p className="text-blue-200 text-sm mt-0.5">
                  Review pairs, assign team numbers, then click Confirm Import
                </p>
              </div>
              <div className="text-right text-sm">
                <div className="text-white font-semibold">{importPreview.filter(t => t.partnerFound).length} paired</div>
                <div className="text-yellow-300">{importPreview.filter(t => !t.partnerFound).length} need review</div>
              </div>
            </div>

            {/* Legend */}
            <div className="px-6 py-3 bg-gray-50 border-b flex flex-wrap gap-4 text-xs text-gray-600">
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-green-500 inline-block"></span> Partner matched</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-yellow-400 inline-block"></span> Partner not registered — importing as Incomplete, partner name saved in Notes</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-blue-500 inline-block"></span> Women's division</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-purple-500 inline-block"></span> Juniors division</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-orange-400 inline-block"></span> Mixed division</span>
            </div>

            {/* Team rows */}
            <div className="divide-y max-h-[60vh] overflow-y-auto">
              {importPreview.map((team, idx) => (
                <div
                  key={idx}
                  className={`px-4 py-3 ${!team.include ? 'opacity-40' : ''} ${!team.partnerFound ? 'bg-yellow-50' : ''}`}
                >
                  <div className="flex flex-wrap items-start gap-3">
                    {/* Include toggle */}
                    <label className="flex items-center gap-1.5 pt-1 cursor-pointer flex-shrink-0">
                      <input
                        type="checkbox"
                        checked={!!team.include}
                        onChange={e => setImportPreview(prev => prev.map((t, i) => i === idx ? {...t, include: e.target.checked} : t))}
                        className="w-4 h-4 accent-blue-600"
                      />
                      <span className="text-xs text-gray-500">Include</span>
                    </label>

                    {/* Team number */}
                    <div className="flex-shrink-0">
                      <label className="text-xs text-gray-500 block mb-0.5">Team #</label>
                      <input
                        type="number"
                        placeholder="##"
                        value={team.team_number}
                        onChange={e => setImportPreview(prev => prev.map((t, i) => i === idx ? {...t, team_number: e.target.value} : t))}
                        className="w-16 px-2 py-1 border-2 border-blue-300 rounded text-sm font-bold text-center focus:ring-2 focus:ring-blue-400"
                      />
                    </div>

                    {/* Competitor 1 */}
                    <div className="flex-1 min-w-[200px]">
                      <label className="text-xs text-gray-500 block mb-0.5">Competitor 1</label>
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={team.competitor1_name}
                          onChange={e => setImportPreview(prev => prev.map((t, i) => i === idx ? {...t, competitor1_name: e.target.value} : t))}
                          className="flex-1 px-2 py-1 border rounded text-sm"
                        />
                        <span className="text-xs text-gray-400 flex-shrink-0">{team.competitor1_tshirt || '—'}</span>
                      </div>
                      <div className="text-xs text-gray-400 mt-0.5">{team.competitor1_email}</div>
                    </div>

                    {/* Competitor 2 */}
                    <div className="flex-1 min-w-[200px]">
                      {team.partnerFound ? (
                        <>
                          <label className="text-xs text-gray-500 block mb-0.5">Competitor 2</label>
                          <div className="flex items-center gap-2">
                            <input
                              type="text"
                              value={team.competitor2_name}
                              onChange={e => setImportPreview(prev => prev.map((t, i) => i === idx ? {...t, competitor2_name: e.target.value} : t))}
                              className="flex-1 px-2 py-1 border rounded text-sm"
                            />
                            {team.competitor2_tshirt && (
                              <span className="text-xs text-gray-400 flex-shrink-0">{team.competitor2_tshirt}</span>
                            )}
                          </div>
                          {team.competitor2_email && (
                            <div className="text-xs text-gray-400 mt-0.5">{team.competitor2_email}</div>
                          )}
                        </>
                      ) : (
                        <>
                          <label className="text-xs text-yellow-600 font-semibold block mb-0.5">
                            Competitor 2 — not registered
                          </label>
                          <div className="px-2 py-1 bg-orange-50 border border-orange-200 rounded text-sm text-gray-400 italic">
                            (blank — importing as Incomplete)
                          </div>
                          {team.partnerRaw && (
                            <div className="text-xs text-gray-500 mt-0.5">
                              📝 Note will say: <em>"Specified partner: {team.partnerRaw} (not registered)"</em>
                            </div>
                          )}
                        </>
                      )}
                    </div>

                    {/* Division flags */}
                    <div className="flex flex-col gap-1 flex-shrink-0">
                      <label className="text-xs text-gray-500 block mb-0.5">Divisions</label>
                      <label className="flex items-center gap-1 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={!!team.is_women}
                          onChange={e => setImportPreview(prev => prev.map((t, i) => i === idx ? {...t, is_women: e.target.checked} : t))}
                          className="w-3.5 h-3.5 accent-blue-500"
                        />
                        <span className="text-xs">Women's</span>
                      </label>
                      <label className="flex items-center gap-1 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={!!team.is_junior}
                          onChange={e => setImportPreview(prev => prev.map((t, i) => i === idx ? {...t, is_junior: e.target.checked} : t))}
                          className="w-3.5 h-3.5 accent-purple-500"
                        />
                        <span className="text-xs">Juniors</span>
                      </label>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Footer */}
            <div className="px-6 py-4 bg-gray-50 rounded-b-xl border-t">
              {/* Unmatched download banner */}
              {importPreview.filter(t => !t.partnerFound).length > 0 && (
                <div className="flex items-center justify-between mb-3 p-3 bg-yellow-50 border border-yellow-300 rounded-lg">
                  <div className="text-sm text-yellow-800">
                    <span className="font-semibold">{importPreview.filter(t => !t.partnerFound).length} competitors</span> could not be auto-matched and will import as <strong>Incomplete</strong> with partner name saved in Notes.
                    Download the list to follow up.
                  </div>
                  <button
                    onClick={downloadUnmatched}
                    className="ml-4 px-4 py-1.5 bg-yellow-500 text-white text-sm rounded-lg hover:bg-yellow-600 font-semibold flex-shrink-0"
                  >
                    ⬇ Download Unmatched CSV
                  </button>
                </div>
              )}
              <div className="flex items-center justify-between gap-4">
                <div className="text-sm text-gray-600">
                  <span className="font-semibold text-green-700">{importPreview.filter(t => t.include && t.team_number).length}</span> teams ready to import
                  {importPreview.filter(t => t.include && !t.team_number).length > 0 && (
                    <span className="text-red-600 ml-2">({importPreview.filter(t => t.include && !t.team_number).length} missing team numbers)</span>
                  )}
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={() => setImportPreview(null)}
                    className="px-5 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 text-sm"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={commitImport}
                    disabled={importing || importPreview.filter(t => t.include && t.team_number).length === 0}
                    className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-semibold disabled:opacity-50"
                  >
                    {importing ? 'Importing…' : `Confirm Import (${importPreview.filter(t => t.include && t.team_number).length} teams)`}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
