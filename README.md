# JARVIS — AI Executive Assistant

Stark black + amber interface. Powered by Claude AI. Deployed on Netlify.

---

## QUICK SETUP (15 minutes)

### 1. Create GitHub repo
- Go to github.com → New repository
- Name it `jarvis` (or anything you like)
- Upload all files from this folder

### 2. Deploy to Netlify (free)
- Go to netlify.com → Log in with GitHub
- Click "Add new site" → "Import an existing project"
- Choose your GitHub repo
- Build settings: leave everything blank (no build command needed)
- Click "Deploy site"

### 3. Add environment variables (for ElevenLabs voice)
- Netlify dashboard → Site Settings → Environment Variables
- Add: `ELEVENLABS_API_KEY` = your ElevenLabs key
- Redeploy the site

### 4. Configure JARVIS on first launch
- Open your Netlify URL
- Click the boot screen to initialize
- Click SETTINGS (top right)
- Enter your name, Claude API key, and any other keys
- Click SAVE CONFIG

---

## API KEYS YOU NEED

| Key | Where to get | Free tier |
|-----|-------------|-----------|
| Claude (Anthropic) | console.anthropic.com | $5 free credit |
| ElevenLabs | elevenlabs.io | 10,000 chars/month |
| Apify | apify.com | 5$/month free |

---

## WHAT WORKS NOW

- Voice output (browser TTS, or ElevenLabs via Netlify function)
- Voice input (Chrome/Edge microphone)
- AI command processing (Claude API)
- Task manager (persists in browser)
- Job listings (static, Apify integration coming next)
- Quick action chips
- Settings panel with persistent memory

## COMING NEXT (Phase 2)

- Gmail integration (read + draft emails)
- Google Calendar integration
- Live job scraping via Apify
- Daily briefing automation

---

## TROUBLESHOOTING

**Voice not working?** Use Chrome or Edge. Safari has limited Web Speech API support.

**Claude not responding?** Check your API key in Settings. Make sure it starts with `sk-ant-`.

**ElevenLabs error?** Make sure you added `ELEVENLABS_API_KEY` in Netlify environment variables and redeployed.

**"CORS error" in console?** You're running the HTML file directly (file://). Deploy to Netlify — CORS only works on a real domain.
