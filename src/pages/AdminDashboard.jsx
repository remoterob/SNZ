import { useNavigate } from 'react-router-dom'
import { clearAdminSession } from '../lib/supabase'
import { Users, Scale, FileText, Trophy } from 'lucide-react'

const SNZ_LOGO = import.meta.env.VITE_SNZ_LOGO_URL || '/api/placeholder/200/80'

export default function AdminDashboard() {
  const navigate = useNavigate()

  const handleLogout = () => {
    clearAdminSession()
    navigate('/admin/login')
  }

  const menuItems = [
    {
      title: 'Team Management',
      description: 'View, add, edit teams and assign numbers',
      icon: Users,
      path: '/admin/teams',
      color: 'bg-blue-500'
    },
    {
      title: 'Check-In Display',
      description: 'Registration status board for the venue',
      icon: Users,
      path: '/checkin',
      color: 'bg-teal-500'
    },
    {
      title: 'Weighmaster',
      description: 'Enter scores and upload photos',
      icon: Scale,
      path: '/admin/weighin',
      color: 'bg-green-500'
    },
    {
      title: 'Manage Results',
      description: 'Handle protests and finalize results',
      icon: Trophy,
      path: '/admin/results',
      color: 'bg-orange-500'
    },
    {
      title: 'Public Leaderboard',
      description: 'View what the public sees',
      icon: FileText,
      path: '/',
      color: 'bg-purple-500'
    }
  ]

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-4">
              <img src={SNZ_LOGO} alt="Spearfishing New Zealand" className="h-12 object-contain" />
              <h1 className="text-3xl font-bold text-gray-900">Admin Dashboard</h1>
            </div>
            <button
              onClick={handleLogout}
              className="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700"
            >
              Logout
            </button>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {menuItems.map((item) => (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className="bg-white rounded-lg shadow-lg p-8 hover:shadow-xl transition text-left"
            >
              <div className="flex items-start gap-4">
                <div className={`${item.color} p-4 rounded-lg text-white`}>
                  <item.icon className="w-8 h-8" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-gray-900 mb-2">{item.title}</h2>
                  <p className="text-gray-600">{item.description}</p>
                </div>
              </div>
            </button>
          ))}
        </div>

        <div className="mt-8 bg-blue-50 border-2 border-blue-200 rounded-lg p-6">
          <h3 className="font-bold text-blue-900 mb-2">Quick Tips</h3>
          <ul className="space-y-2 text-blue-800">
            <li>• Make sure all teams are registered before the competition starts</li>
            <li>• Use the weighmaster interface on a tablet for easy score entry</li>
            <li>• Results are updated in real-time on the public leaderboard</li>
            <li>• Don't forget to finalize results after the protest period!</li>
          </ul>
        </div>
      </div>
    </div>
  )
}
