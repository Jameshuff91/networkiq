# 🧪 NetworkIQ - Immediate Testing Guide

## 🟢 Current System Status
- **Backend API**: Running at http://localhost:8000 ✅
- **Extension**: Ready to load in Chrome ✅  
- **Data Persistence**: Working (backend/data/) ✅
- **Test Mode**: Available (no API keys needed) ✅
- **Production Code**: Linted and tested ✅

---

## ⚡ Quick Test RIGHT NOW (5 minutes)

### Step 1: Verify Backend is Running
```bash
# Check backend status
curl http://localhost:8000/

# If not running, start it:
cd backend
nohup /Users/jimhuff/Documents/Github/networkiq-extension/venv/bin/python main.py > server.log 2>&1 &

# Check logs if issues:
tail -f server.log
```

### Step 2: Load Extension in Chrome
1. Open Chrome browser
2. Go to `chrome://extensions/`
3. Enable "Developer mode" (top right toggle)
4. Click "Load unpacked"
5. Select the `extension/` folder from this project
6. You should see NetworkIQ with blue "N" icon appear!

### Step 3: Test WITHOUT Backend (Test Mode)
1. Click NetworkIQ extension icon in toolbar
2. Click **"Continue in Test Mode"** button
3. Go to any LinkedIn profile: https://www.linkedin.com/in/williamhgates
4. You should see:
   - NetworkIQ score badge overlaid on profile
   - "Generate Message" button
   - Score breakdown when hovering

### Step 4: Test WITH Backend (Full Mode)
1. Click NetworkIQ extension icon
2. Click "Sign Up" 
3. Enter test credentials:
   - Email: test@example.com
   - Password: TestPass123!
4. Go to LinkedIn profile
5. Click "Generate Message" - should create personalized message
6. Check popup - should show stats updating

---

## 📋 Comprehensive Feature Testing

### Test Profile Scoring Algorithm
Go to these profile types and verify scoring makes sense:

1. **Military Profile** (Should score HIGH: 70-100)
   - Search LinkedIn for "USAFA" or "Air Force Academy"
   - Should see high scores and "USAFA Alumni" tag

2. **Tech Profile** (Should score MEDIUM-HIGH: 50-80)
   - Search for "C3 AI" or "Anthropic" employees
   - Should see "Former C3 AI" or "Big Tech AI" connections

3. **Random Profile** (Should score LOW-MEDIUM: 0-50)
   - Any random profile
   - Should have lower score unless connections found

### Test Usage Limits (Free Tier)
1. Sign up as new user (remains free tier)
2. Score profiles until you hit limit (10 per day)
3. 11th attempt should show "Daily limit reached" message
4. Message generation limited to 3 per day

### Test Message Generation
1. Click "Generate Message" on any profile
2. Should get personalized message mentioning:
   - Person's name
   - Their company
   - Shared connections (if any)
3. Message should be under 300 characters

### Test History Page
1. After scoring several profiles
2. Click extension icon → "View History" 
3. Should open history page showing:
   - All scored profiles
   - Filters (Platinum/Gold/Silver/Bronze)
   - Export to CSV functionality
4. Test export - should download CSV file

### Test Data Persistence
1. Score some profiles
2. Close and reopen Chrome
3. Click extension icon
4. Stats should still show previous scores
5. History should still have all profiles

---

## 🔍 Backend API Testing

### Test API Directly
```bash
# Test root endpoint
curl http://localhost:8000/

# Test signup
curl -X POST http://localhost:8000/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"email":"apitest@example.com","password":"Test123!"}'

# Test API documentation
open http://localhost:8000/docs
```

### Run Integration Tests
```bash
cd backend
../venv/bin/pytest test_api.py -v --tb=short
# Should see ~8-10 tests passing
```

---

## 🐛 Debug Checklist

### Extension Not Loading?
```bash
# Check for icon files
ls extension/icons/
# Should see: icon16.png, icon32.png, icon48.png, icon128.png

# If missing, recreate:
cd extension
python3 ../create_icons.py
```

### No Scores Showing on LinkedIn?
1. Open Chrome DevTools (F12) while on LinkedIn
2. Go to Console tab
3. Look for NetworkIQ errors
4. Common fixes:
   - Refresh the LinkedIn page
   - Make sure you're on a profile (not feed)
   - Check extension is enabled

### Backend Connection Issues?
```bash
# Check if backend is running
ps aux | grep "python main.py"

# Check backend logs
tail backend/server.log

# Test backend directly
curl http://localhost:8000/api/stats
```

### Message Generation Not Working?
- In test mode: Uses templates (always works)
- With backend: Check backend/server.log for errors
- OpenAI errors: API key not set or invalid

---

## 📊 What to Evaluate

### User Experience
- Is the scoring instant and visible?
- Do the scores make sense?
- Is the message generation helpful?
- Any confusing UI elements?

### Performance
- How fast do pages load with extension?
- Any lag when scoring profiles?
- Does it slow down LinkedIn?

### Value Proposition
- Would you pay $19/month for this?
- What features are missing?
- What would make it 10x better?

---

## 🚀 After Testing - Quick Fixes

### Change Scoring Weights
Edit `backend/main.py` lines 269-296:
```python
# Adjust these values to change scoring
if "usafa" in profile_text:
    score += 40  # Change this weight
```

### Change Message Templates
Edit `backend/main.py` lines 391-395 for template messages

### Update UI Colors/Style
Edit `extension/content/styles.css` for all visual changes

### Change Rate Limits
Edit `backend/main.py` line 256:
```python
if current_user["subscription_tier"] == "free" and daily_usage["scores"] >= 10:
    # Change 10 to whatever limit you want
```

---

## ✅ Testing Success Criteria

Before proceeding to production deployment, ensure:

- [ ] Can load extension without errors
- [ ] Can score at least 5 different LinkedIn profiles
- [ ] Scores reflect actual connections (military/company)
- [ ] Can generate personalized messages
- [ ] Free tier limits work (10 scores/day)
- [ ] History page shows all scored profiles
- [ ] Can export data to CSV
- [ ] Data persists between sessions
- [ ] No console errors in Chrome DevTools
- [ ] Backend API responds to all endpoints

---

## 📞 Quick Commands Reference

```bash
# Start backend
cd backend && nohup ../venv/bin/python main.py > server.log 2>&1 &

# Stop backend
pkill -f "python main.py"

# View backend logs
tail -f backend/server.log

# Run tests
cd backend && ../venv/bin/pytest test_api.py -v

# Check what's running
ps aux | grep python

# Test API
curl http://localhost:8000/
curl http://localhost:8000/docs
```

---

## 🎯 Ready for Production?

If all tests pass, you're ready to:
1. Get API keys (OpenAI, Stripe)
2. Deploy backend to cloud
3. Submit to Chrome Web Store
4. Launch to real users!

See `FINAL_LAUNCH_CHECKLIST.md` for detailed production setup steps.