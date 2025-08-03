# 🚀 NetworkIQ - Ready to Test!

## ✅ Current Status
- **Backend API**: Running at http://localhost:8000 ✅
- **Extension Icons**: Created ✅  
- **Data Persistence**: Implemented ✅
- **Test Mode**: Available (no OpenAI/Stripe needed) ✅

## 🧪 Test Extension NOW (5 minutes)

### 1. Load Extension in Chrome
1. Open Chrome browser
2. Go to `chrome://extensions/`
3. Enable "Developer mode" (top right)
4. Click "Load unpacked"
5. Select the `extension/` folder
6. You should see NetworkIQ with the blue "N" icon!

### 2. Test the Extension
1. Click the NetworkIQ extension icon in toolbar
2. Click "Continue in Test Mode" (no signup needed!)
3. Go to any LinkedIn profile: https://www.linkedin.com/in/anyone
4. You should see:
   - NetworkIQ score badge on the profile
   - "Generate Message" button
   - Connection insights

### 3. Test with Backend (Optional)
If you want full functionality:
1. Backend is already running at http://localhost:8000
2. Check API docs: http://localhost:8000/docs
3. Sign up through the extension popup
4. Backend will save your data in `backend/data/` folder

## 🔍 What's Working

### Extension Features ✅
- Profile parsing from LinkedIn
- Score calculation (military, company, education matching)
- Message generation (template-based in test mode)
- Beautiful UI overlay on LinkedIn
- Popup with stats and settings

### Backend Features ✅
- User authentication (JWT)
- Profile scoring API
- Message generation (templates or OpenAI)
- Data persistence between restarts
- Usage tracking and limits

## 🐛 Quick Troubleshooting

**Extension won't load?**
- Check Console in chrome://extensions/ for errors
- Make sure you selected the `extension/` folder (not `extension/icons/`)

**No scores showing?**
- Make sure you're on a LinkedIn profile page (not feed/search)
- Open DevTools (F12) → Console to see any errors
- Try refreshing the LinkedIn page

**Backend issues?**
```bash
# Check if server is running
curl http://localhost:8000/

# View server logs
tail backend/server.log

# Restart server if needed
pkill -f "python main.py"
cd backend
nohup /Users/jimhuff/Documents/Github/networkiq-extension/venv/bin/python main.py > server.log 2>&1 &
```

## 📊 What to Test

1. **Score Different Profiles**
   - Military veterans (should score high)
   - Tech professionals
   - Random profiles

2. **Generate Messages**
   - Click "Generate Message" on profiles
   - Copy and check quality

3. **Track Usage**
   - Score multiple profiles
   - Check popup stats update

## 🎯 Next Steps

Once basic testing works:
1. Get OpenAI API key for better messages
2. Set up Stripe for payments
3. Deploy backend to cloud
4. Submit to Chrome Web Store

## 💡 Feedback Needed

Test these and note:
- Does scoring make sense?
- Are messages personalized enough?
- Any UI/UX improvements?
- What features are missing?

---

**Backend Status**: 🟢 Running
**Extension Status**: 🟡 Ready to load
**Database**: 📁 File-based (backend/data/)
**Test Mode**: ✅ Enabled