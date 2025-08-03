# NetworkIQ Quick Start Guide - Test in 15 Minutes

## ⚡ Immediate Testing Steps

### Step 1: Create Icons (2 minutes)
```bash
# Option A: Use Python (fastest)
python3 -c "
from PIL import Image
for size in [16,32,48,128]:
    img = Image.new('RGB', (size, size), (0, 119, 181))
    img.save(f'extension/icons/icon{size}.png')
"

# Option B: Use any image and rename
# Just download any PNG and copy it 4 times with these names:
# icon16.png, icon32.png, icon48.png, icon128.png
```

### Step 2: Start Backend (3 minutes)
```bash
cd backend

# Create .env file
echo "OPENAI_API_KEY=sk-your-key-here
JWT_SECRET=change_this_random_string_12345" > .env

# Install and run
pip install -r requirements.txt
python main.py

# Backend now running at http://localhost:8000
# API docs at http://localhost:8000/docs
```

### Step 3: Load Extension (2 minutes)
1. Open Chrome
2. Go to `chrome://extensions/`
3. Enable "Developer mode" (top right)
4. Click "Load unpacked"
5. Select the `extension/` folder
6. You'll see NetworkIQ appear!

### Step 4: Test It! (5 minutes)
1. Go to any LinkedIn profile
2. Click the NetworkIQ extension icon
3. Click "Continue in Test Mode" (no backend needed!)
4. Go back to LinkedIn - you should see:
   - Score badges on profiles
   - "Generate Message" button
   - Connection insights

## 🧪 Test Mode Features (No Backend Required!)

The extension has a **TEST MODE** that works without any backend:
- Scores profiles based on keywords
- Generates template messages
- Stores data locally
- Perfect for UI/UX testing

To enable: Click "Continue in Test Mode" in the popup

## 🔥 Making It Work With Real Backend

### Backend Quick Fixes Needed:
```python
# In backend/main.py, add after line 54 to persist data:
import json

def save_db():
    with open('db_backup.json', 'w') as f:
        json.dump({
            'users': users_db,
            'profiles': profiles_db,
            'messages': messages_db
        }, f)

def load_db():
    try:
        with open('db_backup.json', 'r') as f:
            data = json.load(f)
            users_db.update(data.get('users', {}))
            profiles_db.update(data.get('profiles', {}))
            messages_db.update(data.get('messages', {}))
    except:
        pass

# Call load_db() on startup
load_db()

# Call save_db() after any data modification
```

### Get OpenAI Key (Required for message generation):
1. Go to https://platform.openai.com/api-keys
2. Create new key
3. Add to backend/.env file

### Skip Stripe (For Testing):
- Comment out Stripe imports in backend/main.py
- Give all users "pro" tier by default
- Add payments later after validation

## 📱 What's Working Now

✅ **Frontend (100% Complete)**
- LinkedIn profile parsing
- Score calculation and display
- Message generation UI
- Popup with stats
- Settings management

✅ **Backend (90% Complete)**
- User auth (JWT)
- Profile scoring API
- Message generation (needs OpenAI key)
- Stats tracking

❌ **What's Missing**
- Icon files (5 min fix)
- Data persistence (15 min fix)
- Stripe integration (skip for MVP)
- Production deployment (2 hours)

## 🚀 Next Steps Priority Order

### Today (Get it working):
1. ✅ Create icons
2. ✅ Test extension on your LinkedIn
3. ✅ Fix any immediate bugs
4. ✅ Add data persistence to backend

### Tomorrow (Get feedback):
1. Deploy backend to Railway.app (free)
2. Update extension with production URL
3. Share with 5 friends for testing
4. Document their feedback

### Day 3 (Iterate):
1. Fix top 3 issues from feedback
2. Add most requested feature
3. Prepare for 10 more testers

### Day 4-7 (Scale):
1. Add Stripe (only if users want to pay)
2. Submit to Chrome Web Store
3. Launch on ProductHunt

## 🎯 Success Metrics for Today

If you can check these boxes, you're ready for users:
- [ ] Extension loads without errors
- [ ] Can see NetworkIQ badges on LinkedIn profiles
- [ ] Can generate a message for a profile
- [ ] Backend accepts signup/login
- [ ] Data persists between sessions

## 💡 Pro Tips

1. **Use Test Mode First**: Don't wait for backend - test UI/UX immediately
2. **Skip Perfection**: Icons can be solid colors, backend can use files
3. **Get Feedback Fast**: Show it broken rather than wait for perfect
4. **Document Issues**: Keep a list of what users complain about
5. **Ignore Edge Cases**: Focus on happy path for first 10 users

## 🆘 Common Issues & Fixes

**Extension won't load?**
- Check if icons exist in extension/icons/
- Check manifest.json for syntax errors
- Look at chrome://extensions/ for error details

**No scores showing?**
- Check if you're on a LinkedIn profile page
- Open DevTools Console for errors
- Try Test Mode first

**Backend won't start?**
- Check Python version (needs 3.8+)
- Install requirements: `pip install -r requirements.txt`
- Check .env file exists with keys

**Can't generate messages?**
- Need OpenAI API key in .env
- Check API key has credits
- Use Test Mode for template messages

## 🎉 You're Ready!

Once you complete the steps above, you have a working MVP that can:
- Score LinkedIn profiles
- Generate personalized messages
- Track usage and stats
- Support multiple users

Share it with 5 people TODAY and get their honest feedback!