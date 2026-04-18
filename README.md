# 🐟 Catfish Cull 2026 - Live Scoring System

Real-time scoring and leaderboard system for the Catfish Cull spearfishing competition.

## Features

✅ **Public Leaderboard** - Live results with auto-refresh  
✅ **Team Management** - Import, edit, and organize teams  
✅ **Weighmaster Interface** - Quick score entry with photos  
✅ **Email Notifications** - Automatic results emails to teams  
✅ **Prize Fish Tracking** - Automatic heaviest/lightest leaders  
✅ **3-Person Team Support** - With ineligibility rules  
✅ **Provisional Results** - Protest period management  
✅ **Mobile Responsive** - Works on tablets and phones  

## Tech Stack

- **Frontend:** React + Vite + Tailwind CSS
- **Backend:** Supabase (PostgreSQL + Real-time)
- **Hosting:** Netlify
- **Email:** Resend API

## Quick Start (Development)

### 1. Install Dependencies

```bash
npm install
```

### 2. Create Environment File

Copy `.env.example` to `.env` and fill in your values:

```bash
cp .env.example .env
```

### 3. Set Up Supabase

Follow `DEPLOYMENT_GUIDE.md` Part 1 to:
- Create Supabase project
- Run database migration
- Get API keys

### 4. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## Deployment

See **`DEPLOYMENT_GUIDE.md`** for complete step-by-step instructions.

Summary:
1. Set up Supabase (database)
2. Set up Resend (emails)
3. Deploy to Netlify
4. Configure environment variables
5. Test and go live!

## Project Structure

```
catfish-cull-production/
├── src/
│   ├── pages/           # React page components
│   ├── components/      # Reusable UI components
│   ├── lib/            # Supabase client & utilities
│   ├── App.jsx         # Main app with routing
│   ├── main.jsx        # Entry point
│   └── index.css       # Tailwind styles
├── supabase/
│   └── migrations/     # Database schema
├── netlify/
│   └── functions/      # Serverless functions for emails
├── public/             # Static assets
├── DEPLOYMENT_GUIDE.md # Full deployment instructions
└── package.json        # Dependencies
```

## Usage

### Admin Access

1. Go to `/admin/login`
2. Enter admin password
3. Access dashboard

### Managing Teams

1. Admin → Teams
2. Import CSV or add manually
3. Assign team numbers
4. Export team list

### During Competition

1. Open weighmaster interface
2. Enter team number + catfish count
3. Optional: add photo & prize fish weights
4. Submit → emails sent automatically!

### Public Display

1. Open root URL on TV/projector
2. Auto-refreshes every 10 seconds
3. Shows latest scores, leaders, and stats

## Environment Variables

Required in production:

```
VITE_SUPABASE_URL          # Your Supabase project URL
VITE_SUPABASE_ANON_KEY     # Your Supabase anon key
VITE_ADMIN_PASSWORD        # Admin login password
VITE_RESEND_API_KEY        # Resend email API key
VITE_SNZ_LOGO_URL          # SNZ logo URL
VITE_SPONSOR_LOGO_URL      # Sponsor logo URL
```

## License

© 2026 Spearfishing New Zealand

## Support

For issues or questions, contact: spearfishingnewzealand@gmail.com
