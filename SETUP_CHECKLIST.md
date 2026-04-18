# ✅ Catfish Cull 2026 - Setup Checklist

Use this checklist to track your deployment progress.

## Phase 1: Supabase Setup (15 minutes)

- [ ] Create Supabase account at supabase.com
- [ ] Create new project: `catfish-cull-2026`
- [ ] Save database password securely
- [ ] Run database migration (copy/paste SQL)
- [ ] Create `catch-photos` bucket (public)
- [ ] Create `assets` bucket (public)
- [ ] Upload `snz-logo.avif` to assets
- [ ] Upload `sponsor-logo.png` to assets
- [ ] Copy Project URL
- [ ] Copy anon public key

## Phase 2: Resend Setup (5 minutes)

- [ ] Create Resend account at resend.com
- [ ] Verify email address
- [ ] (Optional) Add custom domain
- [ ] Create API key with "Sending access"
- [ ] Save API key securely

## Phase 3: GitHub Setup (5 minutes)

- [ ] Create GitHub account (if needed)
- [ ] Create new repository: `catfish-cull-scoring`
- [ ] Push code to GitHub

## Phase 4: Netlify Deployment (10 minutes)

- [ ] Create Netlify account at netlify.com
- [ ] Connect GitHub account
- [ ] Import `catfish-cull-scoring` repository
- [ ] Add environment variables:
  - [ ] VITE_SUPABASE_URL
  - [ ] VITE_SUPABASE_ANON_KEY
  - [ ] VITE_ADMIN_PASSWORD
  - [ ] VITE_RESEND_API_KEY
  - [ ] VITE_SNZ_LOGO_URL
  - [ ] VITE_SPONSOR_LOGO_URL
- [ ] Deploy site
- [ ] Wait for build to complete
- [ ] (Optional) Add custom domain

## Phase 5: Testing (15 minutes)

- [ ] Visit public leaderboard
- [ ] Test admin login
- [ ] Add a test team
- [ ] Submit a test score
- [ ] Check email arrives
- [ ] Check leaderboard updates
- [ ] Test on mobile device
- [ ] Test on tablet

## Phase 6: Pre-Event Setup (1-2 hours)

- [ ] Import teams from TryBooking CSV
- [ ] Review and assign team numbers
- [ ] Handle any partner changes
- [ ] Export team list for printing
- [ ] Print team number labels
- [ ] Test weighmaster interface
- [ ] Train volunteers on the system

## Day of Event

- [ ] Open public leaderboard on TV/projector
- [ ] Open weighmaster interface on tablet
- [ ] Test email sending one more time
- [ ] Have backup internet (mobile hotspot)
- [ ] Have admin password written down
- [ ] Have Supabase credentials accessible

## Emergency Contacts

- Supabase Support: support@supabase.com
- Netlify Support: support@netlify.com
- Resend Support: support@resend.com

## URLs to Save

Public Leaderboard: ___________________________
Admin Login: _______________________________
Supabase Dashboard: _________________________
Netlify Dashboard: __________________________

## Passwords to Remember

Admin Password: ____________________________
Database Password: __________________________

---

## Estimated Total Time

- **Initial Setup:** ~35 minutes
- **Testing:** ~15 minutes
- **Pre-Event Prep:** ~2 hours
- **Total:** ~3 hours (including breaks)

## Need Help?

See `DEPLOYMENT_GUIDE.md` for detailed instructions for each step.
