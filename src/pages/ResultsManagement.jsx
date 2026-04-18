import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { AlertTriangle, CheckCircle, XCircle, Clock, Download } from 'lucide-react'

const SNZ_LOGO = import.meta.env.VITE_SNZ_LOGO_URL || '/api/placeholder/200/80'

export default function ResultsManagement() {
  const navigate = useNavigate()
  const [catches, setCatches] = useState([])
  const [eventState, setEventState] = useState(null)
  const [loading, setLoading] = useState(true)

  const fetchCatches = async () => {
    try {
      // Get catches with full team details
      const { data: catchesData, error: catchesError } = await supabase
        .from('catches')
        .select(`
          *,
          teams (
            team_number,
            division,
            is_junior,
            is_women,
            is_mixed,
            competitor1_name,
            competitor1_email,
            competitor2_name,
            competitor2_email,
            competitor3_name,
            competitor3_email,
            club,
            notes
          )
        `)
        .order('catfish_count', { ascending: false })

      if (catchesError) throw catchesError
      
      // Flatten the data structure for easier use
      const flattenedData = catchesData?.map(entry => ({
        id: entry.id,
        team_id: entry.team_id,
        team_number: entry.teams.team_number,
        division: entry.teams.division,
        is_junior: entry.teams.is_junior,
        is_women: entry.teams.is_women,
        is_mixed: entry.teams.is_mixed,
        competitor1_name: entry.teams.competitor1_name,
        competitor1_email: entry.teams.competitor1_email,
        competitor2_name: entry.teams.competitor2_name,
        competitor2_email: entry.teams.competitor2_email,
        competitor3_name: entry.teams.competitor3_name,
        competitor3_email: entry.teams.competitor3_email,
        club: entry.teams.club,
        notes: entry.teams.notes,
        catfish_count: entry.catfish_count,
        heaviest_fish_grams: entry.heaviest_fish_grams,
        lightest_fish_grams: entry.lightest_fish_grams,
        photo_urls: entry.photo_urls,
        status: entry.status,
        protest_notes: entry.protest_notes,
        created_at: entry.created_at,
        eligible: !entry.teams.competitor3_name // 2-person teams are eligible
      })) || []

      setCatches(flattenedData)
      setLoading(false)
    } catch (error) {
      console.error('Error:', error)
      setLoading(false)
    }
  }

  const fetchEventState = async () => {
    const { data } = await supabase
      .from('event_state')
      .select('*')
      .single()
    
    setEventState(data)
  }

  useEffect(() => {
    fetchCatches()
    fetchEventState()
  }, [])

  const exportToExcel = () => {
    // Prepare data for export
    const exportData = catches.map((entry, index) => {
      const rank = entry.eligible && entry.status !== 'disqualified' ? index + 1 : 'N/A'
      
      return {
        'Rank': rank,
        'Team Number': entry.team_number,
        'Division': entry.division,
        'Is Junior': entry.is_junior ? 'Yes' : 'No',
        'Is Women': entry.is_women ? 'Yes' : 'No',
        'Is Mixed': entry.is_mixed ? 'Yes' : 'No',
        'Competitor 1': entry.competitor1_name,
        'Competitor 1 Email': entry.competitor1_email || '',
        'Competitor 2': entry.competitor2_name,
        'Competitor 2 Email': entry.competitor2_email || '',
        'Competitor 3': entry.competitor3_name || '',
        'Competitor 3 Email': entry.competitor3_email || '',
        'Club': entry.club || '',
        'Catfish Count': entry.catfish_count,
        'Heaviest Fish (g)': entry.heaviest_fish_grams || '',
        'Lightest Fish (g)': entry.lightest_fish_grams || '',
        'Eligible': entry.eligible ? 'Yes' : 'No',
        'Status': entry.status || 'confirmed',
        'Protest Notes': entry.protest_notes || '',
        'Submitted At': entry.created_at ? new Date(entry.created_at).toLocaleString() : '',
        'Notes': entry.notes || ''
      }
    })

    // Convert to CSV
    const headers = Object.keys(exportData[0])
    const csvContent = [
      headers.join(','),
      ...exportData.map(row => 
        headers.map(header => {
          const value = row[header]?.toString() || ''
          // Escape commas and quotes
          return value.includes(',') || value.includes('"') 
            ? `"${value.replace(/"/g, '""')}"` 
            : value
        }).join(',')
      )
    ].join('\n')

    // Download file
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    const url = URL.createObjectURL(blob)
    
    link.setAttribute('href', url)
    link.setAttribute('download', `catfish-cull-results-${new Date().toISOString().split('T')[0]}.csv`)
    link.style.visibility = 'hidden'
    
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const updateStatus = async (catchId, newStatus, protestNotes = '') => {
    try {
      const { error } = await supabase
        .from('catches')
        .update({ status: newStatus, protest_notes: protestNotes })
        .eq('id', catchId)

      if (error) throw error
      fetchCatches()
      alert('Status updated successfully')
    } catch (error) {
      console.error('Error:', error)
      alert('Error updating status: ' + error.message)
    }
  }

  const finalizeResults = async () => {
    if (!confirm('Are you sure you want to finalize all results? This will mark all provisional results as confirmed.')) {
      return
    }

    try {
      const { error } = await supabase
        .from('catches')
        .update({ status: 'confirmed' })
        .eq('status', 'provisional')

      if (error) throw error

      const { error: stateError } = await supabase
        .from('event_state')
        .update({ status: 'final' })
        .eq('id', eventState.id)

      if (stateError) throw stateError

      alert('Results finalized!')
      fetchCatches()
      fetchEventState()
    } catch (error) {
      console.error('Error:', error)
      alert('Error finalizing results: ' + error.message)
    }
  }

  const handleProtest = async (catchId) => {
    const notes = prompt('Enter protest details:')
    if (!notes) return

    updateStatus(catchId, 'under_protest', notes)
  }

  if (loading) {
    return <div className="p-8 text-center">Loading...</div>
  }

  const statusCounts = {
    provisional: catches.filter(c => c.status === 'provisional').length,
    under_protest: catches.filter(c => c.status === 'under_protest').length,
    confirmed: catches.filter(c => c.status === 'confirmed').length,
    disqualified: catches.filter(c => c.status === 'disqualified').length
  }

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <div className="max-w-6xl mx-auto">
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <div className="flex justify-between items-center mb-6">
            <div className="flex items-center gap-4">
              <img src={SNZ_LOGO} alt="Spearfishing New Zealand" className="h-12 object-contain" />
              <h1 className="text-3xl font-bold text-gray-900">Manage Results</h1>
            </div>
            <div className="flex gap-3">
              <button
                onClick={exportToExcel}
                className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 flex items-center gap-2"
              >
                <Download size={20} />
                Export to Excel
              </button>
              <button
                onClick={() => navigate('/admin')}
                className="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700"
              >
                Back to Dashboard
              </button>
            </div>
          </div>

          {/* Status Summary */}
          <div className="grid md:grid-cols-4 gap-4 mb-6">
            <div className="bg-yellow-50 border-2 border-yellow-200 rounded-lg p-4">
              <div className="flex items-center gap-2 text-yellow-700 mb-1">
                <Clock className="w-5 h-5" />
                <span className="font-semibold">Provisional</span>
              </div>
              <p className="text-2xl font-bold text-yellow-800">{statusCounts.provisional}</p>
            </div>

            <div className="bg-orange-50 border-2 border-orange-200 rounded-lg p-4">
              <div className="flex items-center gap-2 text-orange-700 mb-1">
                <AlertTriangle className="w-5 h-5" />
                <span className="font-semibold">Under Protest</span>
              </div>
              <p className="text-2xl font-bold text-orange-800">{statusCounts.under_protest}</p>
            </div>

            <div className="bg-green-50 border-2 border-green-200 rounded-lg p-4">
              <div className="flex items-center gap-2 text-green-700 mb-1">
                <CheckCircle className="w-5 h-5" />
                <span className="font-semibold">Confirmed</span>
              </div>
              <p className="text-2xl font-bold text-green-800">{statusCounts.confirmed}</p>
            </div>

            <div className="bg-red-50 border-2 border-red-200 rounded-lg p-4">
              <div className="flex items-center gap-2 text-red-700 mb-1">
                <XCircle className="w-5 h-5" />
                <span className="font-semibold">Disqualified</span>
              </div>
              <p className="text-2xl font-bold text-red-800">{statusCounts.disqualified}</p>
            </div>
          </div>

          {/* Finalize Button */}
          {eventState?.status !== 'final' && (
            <button
              onClick={finalizeResults}
              className="w-full bg-blue-600 text-white py-3 rounded-lg font-bold hover:bg-blue-700 mb-6"
            >
              Finalize All Results
            </button>
          )}

          {eventState?.status === 'final' && (
            <div className="bg-green-50 border-2 border-green-200 rounded-lg p-4 mb-6 text-center">
              <CheckCircle className="w-8 h-8 text-green-600 mx-auto mb-2" />
              <p className="font-bold text-green-800">Results have been finalized</p>
            </div>
          )}
        </div>

        {/* Results Table */}
        <div className="bg-white rounded-lg shadow-lg overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left">Team</th>
                <th className="px-4 py-3 text-left">Division</th>
                <th className="px-4 py-3 text-center">Catfish</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-left">Actions</th>
              </tr>
            </thead>
            <tbody>
              {catches.map((c) => (
                <tr key={c.id} className="border-b hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div>
                      <div className="font-bold">#{c.team_number}</div>
                      <div className="text-sm text-gray-600">{c.team_names}</div>
                    </div>
                  </td>
                  <td className="px-4 py-3">{c.division}</td>
                  <td className="px-4 py-3 text-center text-xl font-bold">{c.catfish_count}</td>
                  <td className="px-4 py-3">
                    <span className={`px-3 py-1 rounded-full text-sm font-semibold ${
                      c.status === 'provisional' ? 'bg-yellow-100 text-yellow-800' :
                      c.status === 'under_protest' ? 'bg-orange-100 text-orange-800' :
                      c.status === 'confirmed' ? 'bg-green-100 text-green-800' :
                      'bg-red-100 text-red-800'
                    }`}>
                      {c.status === 'provisional' && 'Provisional'}
                      {c.status === 'under_protest' && 'Under Protest'}
                      {c.status === 'confirmed' && 'Confirmed'}
                      {c.status === 'disqualified' && 'Disqualified'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <select
                      value={c.status}
                      onChange={(e) => {
                        if (e.target.value === 'under_protest') {
                          handleProtest(c.id)
                        } else {
                          updateStatus(c.id, e.target.value)
                        }
                      }}
                      className="px-3 py-1 border rounded-lg text-sm"
                      disabled={eventState?.status === 'final'}
                    >
                      <option value="provisional">Provisional</option>
                      <option value="under_protest">Under Protest</option>
                      <option value="confirmed">Confirmed</option>
                      <option value="disqualified">Disqualified</option>
                    </select>
                  </td>
                </tr>
              ))}
              {catches.length === 0 && (
                <tr>
                  <td colSpan="5" className="px-4 py-8 text-center text-gray-500">
                    No results yet
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="mt-6 bg-blue-50 border-2 border-blue-200 rounded-lg p-4">
          <h3 className="font-bold text-blue-900 mb-2">Important</h3>
          <ul className="text-blue-800 text-sm space-y-1">
            <li>• Review all results before finalizing</li>
            <li>• Protest period: Until {eventState?.protest_deadline}</li>
            <li>• Once finalized, status changes are locked</li>
            <li>• Disqualified teams appear on leaderboard but marked clearly</li>
          </ul>
        </div>
      </div>
    </div>
  )
}
