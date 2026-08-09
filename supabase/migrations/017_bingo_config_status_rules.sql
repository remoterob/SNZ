-- Makes Fish Bingo's season status and rules text admin-editable
-- (previously status was purely computed from comp_start/comp_end at
-- render time, and rules text was hardcoded JSX in BingoRulesPage.jsx).
-- Dates (comp_start/comp_end) were already columns — no change needed there,
-- they just gain an admin UI.

alter table bingo_comp_config
  add column if not exists status text not null default 'upcoming'
    check (status in ('upcoming', 'active', 'closed'));

alter table bingo_comp_config
  add column if not exists rules_sections jsonb not null default '[]'::jsonb;

-- Backfill status from the existing is_active flag + dates for the current row.
update bingo_comp_config
set status = case
  when not is_active then 'closed'
  when now() < comp_start then 'upcoming'
  when now() > comp_end then 'closed'
  else 'active'
end
where status = 'upcoming';

-- Seed rules_sections with the text that was previously hardcoded in
-- BingoRulesPage.jsx, so nothing changes visually until an admin edits it.
-- The "Dates" section is intentionally not included here — the rules page
-- now generates that one from comp_start/comp_end directly.
update bingo_comp_config
set rules_sections = '[
  {"title": "1️⃣ Participation & Risk", "body": "**Participation in Fish Bingo is entirely at your own risk.** Spearfishing and freediving are inherently dangerous activities that carry the risk of serious injury or death. By participating in Fish Bingo, you acknowledge you accept all risks, agree the organisers have no responsibility or liability for any injury, loss, or death, and confirm you will comply with all relevant laws and safety practices (including diving with a competent buddy and staying within your limits). Participants under 18 must be accompanied *in the water* and directly supervised by a parent or legal guardian. **Dive safe, with a good buddy.**"},
  {"title": "2️⃣ Eligibility", "body": "Open to active SNZ members. Fish must be speared in New Zealand waters only."},
  {"title": "3️⃣ How to Play", "body": "Find your fish and claim it in the app. 📸 Upload a pic against your claim within 7 days of catching the fish.\n\nFish must be caught by you, while freediving (no tanks, no tackle)."},
  {"title": "4️⃣ Scoring", "body": "Points are based on species difficulty. Points are **doubled** if it is truly the first time you have ever caught that species.\n\nSome species combinations unlock bonus rows for extra points."},
  {"title": "5️⃣ Safety & Fair Play", "body": "All local laws and size limits apply. Treat the ocean with respect – no waste, no overfishing."},
  {"title": "6️⃣ Participation > Prizes", "body": "This comp is about stoke, species, and community. By participating and uploading pictures, you give consent for us to share your pictures via SNZ social media."},
  {"title": "7️⃣ The Spirit of Bingo", "body": "Give your mate tips, bring them on trips, and help them target new species too. It is meant to be fun. Be safe, be honest, cheer on others, and remember: the ocean always wins in the end."}
]'::jsonb
where rules_sections = '[]'::jsonb;
