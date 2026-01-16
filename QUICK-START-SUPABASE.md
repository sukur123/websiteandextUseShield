# 🚀 Quick Start - Supabase Setup

## ⚡ 5-Minute Setup

### 1️⃣ Create Supabase Project (2 min)
1. Go to **[supabase.com](https://supabase.com)** → Sign in with GitHub
2. New Project → Name: `money-trap-analyzer`
3. **Save your database password!**
4. Choose region → Create project

### 2️⃣ Get Credentials (1 min)
1. Wait for project creation (~2 min)
2. Go to **Settings** → **API**
3. Copy:
   - **Project URL**: `https://xxxxx.supabase.co`
   - **Anon Key**: `eyJhbGciOiJIUzI1NiIs...`

### 3️⃣ Update Extension (30 sec)
Open `chrome-extension/src/auth.js` (lines 8-9):
```javascript
const SUPABASE_URL = 'https://your-project-id.supabase.co'; // ← Paste YOUR URL
const SUPABASE_ANON_KEY = 'your-anon-key-here'; // ← Paste YOUR KEY
```

### 4️⃣ Set Up Database (2 min)
1. Supabase dashboard → **SQL Editor**
2. Open `SUPABASE-SETUP.md` → Copy SQL from **Step 3**
3. Paste in SQL Editor → Run
4. Should see: `subscriptions` and `usage_tracking` tables created

### 5️⃣ Enable Authentication (1 min)
1. Supabase → **Authentication** → **Providers**
2. Enable **Email** provider
3. **URL Configuration**:
   - Site URL: `chrome-extension://YOUR_EXTENSION_ID` (get from chrome://extensions)
   - Add redirect URL: `chrome-extension://YOUR_EXTENSION_ID/*`

### 6️⃣ Test Extension (1 min)
1. Chrome → `chrome://extensions` → Developer mode ON
2. Load unpacked → Select `chrome-extension/` folder
3. Copy extension ID from page
4. Click extension icon → Should redirect to login
5. Register new account → Check email for verification

---

## ✅ Verification Checklist

After setup, verify:

- [ ] Supabase credentials updated in `src/auth.js`
- [ ] SQL schema created (2 tables: `subscriptions`, `usage_tracking`)
- [ ] Email authentication enabled
- [ ] Site URL configured with extension ID
- [ ] Extension loads without errors (check chrome://extensions)
- [ ] Can register new account
- [ ] Receive verification email
- [ ] Can login after verifying email
- [ ] Free tier subscription created automatically

---

## 🔧 Common Issues

### "Network error" on login
**Fix**: Check Supabase credentials in `src/auth.js` (lines 8-9)

### Email not received
**Fix**: Check spam folder, or Supabase → Authentication → Email Templates

### Extension won't load
**Fix**: Chrome → chrome://extensions → Check for errors, reload extension

### Database query fails
**Fix**: Verify SQL schema ran successfully (Supabase → Table Editor → see `subscriptions` table)

---

## 📚 Full Documentation

- **Complete Setup**: `SUPABASE-SETUP.md` (detailed guide)
- **Migration Info**: `SUPABASE-MIGRATION.md` (what changed)
- **Architecture**: `.github/copilot-instructions.md` (tech details)
- **Supabase Docs**: https://supabase.com/docs

---

## 🎯 Next Steps

After basic setup works:

1. **Test analysis flow**: Navigate to Terms of Service page → Analyze
2. **Check database**: Supabase → `usage_tracking` → See analysis records
3. **Choose payment provider**: Stripe, Paddle, or other (Lemon Squeezy had issues)
4. **Set up payments**: Add checkout flow, webhook for subscription activation
5. **Production**: Enable Supabase production mode, review security

---

## 🆘 Need Help?

1. Read `SUPABASE-SETUP.md` for detailed guide
2. Check Supabase dashboard for errors (Logs section)
3. Inspect extension console: chrome://extensions → Service Worker
4. Join Supabase Discord: https://discord.supabase.com

---

**Status**: ✅ Ready to use with Supabase
**Time to setup**: ~10 minutes
**Cost**: Free (Supabase free tier includes 500MB database, 50,000 monthly active users)
