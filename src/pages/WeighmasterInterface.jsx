import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { Camera, Check, Search, AlertTriangle, Download } from 'lucide-react'

const SNZ_LOGO = import.meta.env.VITE_SNZ_LOGO_URL || '/api/placeholder/200/80'

export default function WeighmasterInterface() {
  const navigate = useNavigate()
  const [teams, setTeams] = useState([])
  const [teamNumber, setTeamNumber] = useState('')
  const [searchName, setSearchName] = useState('')
  const [filteredTeams, setFilteredTeams] = useState([])
  const [showSearchResults, setShowSearchResults] = useState(false)
  const [selectedTeam, setSelectedTeam] = useState(null)
  const [catfishCount, setCatfishCount] = useState('')
  const [heaviestFish, setHeaviestFish] = useState('')
  const [lightestFish, setLightestFish] = useState('')
  const [photos, setPhotos] = useState([])
  const [submitting, setSubmitting] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [existingCatch, setExistingCatch] = useState(null)
  const [isEditMode, setIsEditMode] = useState(false)

  useEffect(() => {
    fetchTeams()
  }, [])

  const fetchTeams = async () => {
    const { data } = await supabase
      .from('teams')
      .select('*')
      .order('team_number')
    
    setTeams(data || [])
  }

  useEffect(() => {
    if (teamNumber) {
      const team = teams.find(t => t.team_number === parseInt(teamNumber))
      setSelectedTeam(team || null)
      setShowSearchResults(false)
      if (team) {
        checkExistingScore(team.id)
      }
    } else {
      setSelectedTeam(null)
      setExistingCatch(null)
      setIsEditMode(false)
    }
  }, [teamNumber, teams])

  useEffect(() => {
    if (searchName.length >= 2) {
      const searchLower = searchName.toLowerCase()
      const matches = teams.filter(t => 
        t.competitor1_name.toLowerCase().includes(searchLower) ||
        t.competitor2_name.toLowerCase().includes(searchLower) ||
        (t.competitor3_name && t.competitor3_name.toLowerCase().includes(searchLower))
      )
      setFilteredTeams(matches)
      setShowSearchResults(true)
    } else {
      setFilteredTeams([])
      setShowSearchResults(false)
    }
  }, [searchName, teams])

  const selectTeamFromSearch = (team) => {
    setSelectedTeam(team)
    setTeamNumber(team.team_number.toString())
    setSearchName('')
    setShowSearchResults(false)
    checkExistingScore(team.id)
  }

  const checkExistingScore = async (teamId) => {
    try {
      const { data, error } = await supabase
        .from('catches')
        .select('*')
        .eq('team_id', teamId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

      if (error && error.code !== 'PGRST116') { // PGRST116 = no rows found
        console.error('Error checking score:', error)
        return
      }

      if (data) {
        // Found existing score - load it into form
        setExistingCatch(data)
        setIsEditMode(true)
        setCatfishCount(data.catfish_count.toString())
        setHeaviestFish(data.heaviest_fish_grams ? data.heaviest_fish_grams.toString() : '')
        setLightestFish(data.lightest_fish_grams ? data.lightest_fish_grams.toString() : '')
        setPhotos(data.photo_urls || [])
      } else {
        // No existing score
        setExistingCatch(null)
        setIsEditMode(false)
        setCatfishCount('')
        setHeaviestFish('')
        setLightestFish('')
        setPhotos([])
      }
    } catch (err) {
      console.error('Error:', err)
    }
  }

  const handlePhotoUpload = async (e) => {
    const files = Array.from(e.target.files)
    
    for (const file of files) {
      const fileExt = file.name.split('.').pop()
      const fileName = `${Date.now()}-${Math.random()}.${fileExt}`
      const filePath = `${fileName}`

      const { error: uploadError } = await supabase.storage
        .from('catch-photos')
        .upload(filePath, file)

      if (uploadError) {
        console.error('Error uploading:', uploadError)
        continue
      }

      const { data } = supabase.storage
        .from('catch-photos')
        .getPublicUrl(filePath)

      setPhotos(prev => [...prev, data.publicUrl])
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSubmitting(true)

    try {
      if (isEditMode && existingCatch) {
        // Update existing catch
        const { error: updateError } = await supabase
          .from('catches')
          .update({
            catfish_count: parseInt(catfishCount),
            heaviest_fish_grams: heaviestFish ? parseInt(heaviestFish) : null,
            lightest_fish_grams: lightestFish ? parseInt(lightestFish) : null,
            photo_urls: photos,
            updated_at: new Date().toISOString()
          })
          .eq('id', existingCatch.id)

        if (updateError) throw updateError

        alert('Score updated successfully!')
      } else {
        // Insert new catch
        const { data: catchData, error: catchError } = await supabase
          .from('catches')
          .insert([{
            team_id: selectedTeam.id,
            catfish_count: parseInt(catfishCount),
            heaviest_fish_grams: heaviestFish ? parseInt(heaviestFish) : null,
            lightest_fish_grams: lightestFish ? parseInt(lightestFish) : null,
            photo_urls: photos,
            status: 'provisional'
          }])
          .select()
          .single()

        if (catchError) throw catchError

        // Send email via Netlify function
        const emails = [selectedTeam.competitor1_email, selectedTeam.competitor2_email]
        if (selectedTeam.competitor3_email) emails.push(selectedTeam.competitor3_email)

        const eligible = !selectedTeam.competitor3_name

        await fetch('/.netlify/functions/send-results-email', {
          method: 'POST',
          body: JSON.stringify({
            emails,
            teamNumber: selectedTeam.team_number,
            teamNames: `${selectedTeam.competitor1_name} & ${selectedTeam.competitor2_name}${selectedTeam.competitor3_name ? ' & ' + selectedTeam.competitor3_name : ''}`,
            catfishCount: parseInt(catfishCount),
            division: selectedTeam.division,
            heaviestFish: heaviestFish ? parseInt(heaviestFish) : null,
            lightestFish: lightestFish ? parseInt(lightestFish) : null,
            eligible
          })
        })

        alert('Score submitted successfully! Email sent to team.')
      }
      
      // Reset form
      setTeamNumber('')
      setSearchName('')
      setSelectedTeam(null)
      setCatfishCount('')
      setHeaviestFish('')
      setLightestFish('')
      setPhotos([])
      setShowSearchResults(false)
      setExistingCatch(null)
      setIsEditMode(false)
    } catch (error) {
      console.error('Error submitting:', error)
      alert('Error submitting score: ' + error.message)
    } finally {
      setSubmitting(false)
    }
  }


  const handleDeleteCatch = async () => {
    if (!existingCatch) return

    const teamLabel = `Team #${selectedTeam.team_number} (${selectedTeam.competitor1_name}${selectedTeam.competitor2_name ? ' & ' + selectedTeam.competitor2_name : ''})`

    const confirmed = window.confirm(
      `⚠️ DELETE CATCH — Are you sure?\n\n${teamLabel}\nCatfish count: ${catfishCount}\n\nThis will permanently remove their entire score entry. This cannot be undone.`
    )

    if (!confirmed) return

    setDeleting(true)
    try {
      const { error } = await supabase
        .from('catches')
        .delete()
        .eq('id', existingCatch.id)

      if (error) throw error

      alert(`✅ Catch deleted for ${teamLabel}.`)

      // Reset form
      setTeamNumber('')
      setSearchName('')
      setSelectedTeam(null)
      setCatfishCount('')
      setHeaviestFish('')
      setLightestFish('')
      setPhotos([])
      setShowSearchResults(false)
      setExistingCatch(null)
      setIsEditMode(false)
    } catch (error) {
      console.error('Error deleting catch:', error)
      alert('Error deleting catch: ' + error.message)
    } finally {
      setDeleting(false)
    }
  }

  const exportResults = async () => {
    // Fetch all catches joined with team data
    const { data: catches } = await supabase
      .from('catches')
      .select('*, teams(*)')
      .order('created_at', { ascending: true })

    const esc = v => `"${String(v ?? '').replace(/"/g, '""')}"`

    const headers = [
      'Team Number',
      'Competitor 1',
      'Competitor 2',
      'Competitor 3',
      'Club',
      'Division',
      'Registered',
      'Attended Briefing',
      'Catfish Count',
      'Heaviest Fish (g)',
      'Lightest Fish (g)',
      'Status',
      'Submitted At',
      'Notes',
    ]

    const divisionStr = (t) => {
      if (t.is_junior && t.is_women) return 'Women / Juniors'
      if (t.is_junior) return 'Juniors'
      if (t.is_women) return 'Women'
      if (t.is_mixed) return 'Mixed'
      return 'Open'
    }

    // Build one row per team - include all teams, catch data blank if not yet weighed in
    const allTeams = [...teams]
    const catchMap = {}
    if (catches) {
      for (const c of catches) {
        // Keep latest catch per team
        if (!catchMap[c.team_id] || c.created_at > catchMap[c.team_id].created_at) {
          catchMap[c.team_id] = c
        }
      }
    }

    const rows = allTeams.map(t => {
      const c = catchMap[t.id]
      return [
        esc(t.team_number),
        esc(t.competitor1_name || ''),
        esc(t.competitor2_name || ''),
        esc(t.competitor3_name || ''),
        esc(t.club || ''),
        esc(divisionStr(t)),
        esc(t.registered ? 'Yes' : 'No'),
        esc(t.attended_briefing ? 'Yes' : 'No'),
        esc(c ? c.catfish_count : ''),
        esc(c?.heaviest_fish_grams ?? ''),
        esc(c?.lightest_fish_grams ?? ''),
        esc(c ? c.status : 'not entered'),
        esc(c ? new Date(c.created_at).toLocaleString('en-NZ') : ''),
        esc(t.notes || ''),
      ].join(',')
    })

    const csv = [headers.map(h => esc(h)).join(','), ...rows].join('\n')
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `catfish-results-${new Date().toISOString().slice(0,10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <div className="flex justify-between items-center mb-6">
            <div className="flex items-center gap-4">
              <img src={SNZ_LOGO} alt="Spearfishing New Zealand" className="h-12 object-contain" />
              <h1 className="text-3xl font-bold text-gray-900">Weighmaster Interface</h1>
            </div>
            <div className="flex gap-2">
              <button
                onClick={exportResults}
                className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 flex items-center gap-2"
              >
                <Download className="w-4 h-4" />
                Export Results CSV
              </button>
              <button
                onClick={() => navigate('/admin')}
                className="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700"
              >
                Back to Dashboard
              </button>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Team Number OR Search */}
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-lg font-semibold mb-2">Team Number</label>
                <input
                  type="number"
                  value={teamNumber}
                  onChange={(e) => {
                    setTeamNumber(e.target.value)
                    setSearchName('') // Clear search when typing number
                  }}
                  placeholder="Enter team number"
                  className="w-full px-4 py-3 text-2xl border-2 rounded-lg focus:border-blue-500 focus:outline-none"
                  disabled={searchName.length > 0}
                />
              </div>

              <div className="relative">
                <label className="block text-lg font-semibold mb-2">OR Search by Name</label>
                <input
                  type="text"
                  value={searchName}
                  onChange={(e) => {
                    setSearchName(e.target.value)
                    setTeamNumber('') // Clear team number when searching
                  }}
                  placeholder="Type competitor name..."
                  className="w-full px-4 py-3 border-2 rounded-lg focus:border-blue-500 focus:outline-none"
                  disabled={teamNumber.length > 0}
                />
                
                {/* Search Results Dropdown */}
                {showSearchResults && filteredTeams.length > 0 && (
                  <div className="absolute z-10 w-full mt-1 bg-white border-2 border-blue-500 rounded-lg shadow-xl max-h-96 overflow-y-auto">
                    {filteredTeams.map(team => (
                      <button
                        key={team.id}
                        type="button"
                        onClick={() => selectTeamFromSearch(team)}
                        className="w-full px-4 py-3 text-left hover:bg-blue-50 border-b last:border-b-0 transition"
                      >
                        <div className="font-bold text-blue-600">Team #{team.team_number}</div>
                        <div className="text-sm text-gray-700">
                          {team.competitor1_name} & {team.competitor2_name}
                          {team.competitor3_name && ` & ${team.competitor3_name}`}
                        </div>
                        <div className="text-xs text-gray-500">{team.division}</div>
                      </button>
                    ))}
                  </div>
                )}
                
                {showSearchResults && filteredTeams.length === 0 && searchName.length >= 2 && (
                  <div className="absolute z-10 w-full mt-1 bg-white border-2 border-gray-300 rounded-lg shadow-lg p-4">
                    <p className="text-gray-500 text-center">No teams found matching "{searchName}"</p>
                  </div>
                )}
              </div>
            </div>

            {/* Team Info Display */}
            {selectedTeam && (
              <div className={`border-2 rounded-lg p-4 ${
                isEditMode 
                  ? 'bg-orange-50 border-orange-400' 
                  : 'bg-blue-50 border-blue-200'
              }`}>
                {isEditMode && (
                  <div className="mb-3 pb-3 border-b-2 border-orange-300">
                    <div className="flex items-center gap-2 text-orange-800 font-bold">
                      <AlertTriangle className="w-5 h-5" />
                      <span>EDIT MODE - This team already has a score</span>
                    </div>
                    <p className="text-sm text-orange-700 mt-1">
                      Existing score loaded. Make changes and submit to update.
                    </p>
                  </div>
                )}
                <h3 className="font-bold text-lg mb-2">Team #{selectedTeam.team_number}</h3>
                <p><strong>Division:</strong> {selectedTeam.division}</p>
                <p><strong>Competitors:</strong> {selectedTeam.competitor1_name} & {selectedTeam.competitor2_name}</p>
                {selectedTeam.competitor3_name && (
                  <>
                    <p className="text-orange-600"><strong>+ {selectedTeam.competitor3_name}</strong></p>
                    <p className="text-sm text-orange-600 mt-2">⚠️ 3-person team - Not eligible for prizes</p>
                  </>
                )}
                {isEditMode && existingCatch && (
                  <div className="mt-3 pt-3 border-t-2 border-orange-200 text-sm">
                    <p className="text-gray-600">
                      <strong>Original submission:</strong> {new Date(existingCatch.created_at).toLocaleString()}
                    </p>
                    {existingCatch.updated_at !== existingCatch.created_at && (
                      <p className="text-gray-600">
                        <strong>Last updated:</strong> {new Date(existingCatch.updated_at).toLocaleString()}
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}

            {!selectedTeam && teamNumber && (
              <div className="bg-red-50 border-2 border-red-200 rounded-lg p-4 text-red-700">
                Team #{teamNumber} not found. Please check the number.
              </div>
            )}

            {/* Catfish Count */}
            <div>
              <label className="block text-lg font-semibold mb-2">Catfish Count *</label>
              <input
                type="number"
                required
                min="0"
                value={catfishCount}
                onChange={(e) => setCatfishCount(e.target.value)}
                placeholder="Number of catfish"
                className="w-full px-4 py-3 text-2xl border-2 rounded-lg focus:border-blue-500 focus:outline-none"
                disabled={!selectedTeam}
              />
            </div>

            {/* Prize Fish (Optional) */}
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-lg font-semibold mb-2">
                  Heaviest Fish (grams)
                  <span className="text-sm font-normal text-gray-500"> - Optional</span>
                </label>
                <input
                  type="number"
                  min="1"
                  value={heaviestFish}
                  onChange={(e) => setHeaviestFish(e.target.value)}
                  placeholder="e.g., 450"
                  className="w-full px-4 py-3 border-2 rounded-lg focus:border-blue-500 focus:outline-none"
                  disabled={!selectedTeam}
                />
              </div>

              <div>
                <label className="block text-lg font-semibold mb-2">
                  Lightest Fish (grams)
                  <span className="text-sm font-normal text-gray-500"> - Optional</span>
                </label>
                <input
                  type="number"
                  min="1"
                  value={lightestFish}
                  onChange={(e) => setLightestFish(e.target.value)}
                  placeholder="e.g., 85"
                  className="w-full px-4 py-3 border-2 rounded-lg focus:border-blue-500 focus:outline-none"
                  disabled={!selectedTeam}
                />
              </div>
            </div>

            {/* Photo Upload */}
            <div>
              <label className="block text-lg font-semibold mb-2">
                Photos
                <span className="text-sm font-normal text-gray-500"> - Optional</span>
              </label>
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-6">
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handlePhotoUpload}
                  className="hidden"
                  id="photo-upload"
                  disabled={!selectedTeam}
                />
                <label
                  htmlFor="photo-upload"
                  className={`flex flex-col items-center cursor-pointer ${!selectedTeam && 'opacity-50'}`}
                >
                  <Camera className="w-12 h-12 text-gray-400 mb-2" />
                  <span className="text-gray-600">Click to upload photos</span>
                  <span className="text-sm text-gray-400">or drag and drop</span>
                </label>
              </div>
              {photos.length > 0 && (
                <div className="mt-2 flex gap-2 flex-wrap">
                  {photos.map((url, i) => (
                    <div key={i} className="relative">
                      <img src={url} alt="Catch" className="w-20 h-20 object-cover rounded" />
                      <button
                        type="button"
                        onClick={() => setPhotos(photos.filter((_, idx) => idx !== i))}
                        className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={!selectedTeam || !catfishCount || submitting || deleting}
              className={`w-full py-4 rounded-lg text-xl font-bold disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center justify-center gap-2 ${
                isEditMode 
                  ? 'bg-orange-600 hover:bg-orange-700 text-white' 
                  : 'bg-green-600 hover:bg-green-700 text-white'
              }`}
            >
              {submitting ? (
                'Submitting...'
              ) : (
                <>
                  <Check className="w-6 h-6" />
                  {isEditMode ? 'Update Score' : 'Submit Score & Send Email'}
                </>
              )}
            </button>

            {/* Delete Button — only shown in edit mode */}
            {isEditMode && (
              <button
                type="button"
                onClick={handleDeleteCatch}
                disabled={deleting || submitting}
                className="w-full py-3 rounded-lg text-base font-bold border-2 border-red-300 text-red-600 hover:bg-red-50 hover:border-red-500 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-colors"
              >
                {deleting ? (
                  'Deleting...'
                ) : (
                  <>
                    <span className="text-lg">🗑️</span>
                    Delete This Catch Entry
                  </>
                )}
              </button>
            )}
          </form>
        </div>

        <div className="bg-yellow-50 border-2 border-yellow-200 rounded-lg p-4">
          <h3 className="font-bold text-yellow-800 mb-2">Quick Tips</h3>
          <ul className="text-yellow-800 text-sm space-y-1">
            <li>• Enter team number OR search by competitor name</li>
            <li>• Search works with partial names (e.g., "John" finds "John Smith")</li>
            <li>• If a team already has a score, it will load automatically for editing</li>
            <li>• Edit mode shows an orange warning - make changes and submit to update</li>
            <li>• In edit mode, use "Delete This Catch Entry" to fully remove a score</li>
            <li>• Catfish count is required, prize fish weights are optional</li>
            <li>• Photos are optional but recommended for verification</li>
            <li>• Emails are sent automatically for new scores (not for updates)</li>
          </ul>
        </div>
      </div>
    </div>
  )
}
