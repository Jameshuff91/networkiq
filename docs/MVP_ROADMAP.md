# NetworkIQ MVP Roadmap - Ship in 48 Hours

## 🎯 Goal: Get 10 Real Users Testing Within 48 Hours

### Phase 1: Core Functionality (Hours 0-12) ✅ Make It Work
**Objective**: Get the extension working on YOUR machine

#### Backend Setup (2 hours)
1. **Environment Setup**
   ```bash
   cd backend
   # Create .env file with:
   OPENAI_API_KEY=your_key_here
   JWT_SECRET=change_this_to_random_string
   # Skip Stripe for now - add fake Pro access
   ```

2. **Start Backend**
   ```bash
   pip install -r requirements.txt
   python main.py
   ```

3. **Quick Database Fix** (Critical)
   - Current in-memory storage loses data on restart
   - Quick fix: Add JSON file persistence to backend/main.py
   - Just pickle.dump() the dictionaries to files on write

#### Extension Testing (4 hours)
1. **Add Missing Icons** (Quick fix)
   - Create simple 128x128, 48x48, 32x32, 16x16 PNG files
   - Even colored squares work for testing
   - Place in extension/icons/ folder

2. **Load Extension**
   - Chrome → Extensions → Developer Mode → Load Unpacked
   - Select extension/ folder
   - Test on your own LinkedIn profile first

3. **Fix API Connection**
   - Update service_worker.js to point to your backend URL
   - Add CORS headers if needed
   - Test scoring works on real profiles

#### Critical Fixes (6 hours)
1. **Scoring Algorithm Validation**
   - Test on 10 different LinkedIn profiles
   - Verify scoring makes sense
   - Adjust weights in scorer.js

2. **Message Generation**
   - Test OpenAI integration
   - Ensure messages are under 300 chars
   - Add fallback templates if API fails

### Phase 2: Deploy for Beta Users (Hours 12-24) 🚀 Make It Available
**Objective**: Get it online so others can test

#### Quick Deployment (4 hours)
1. **Backend Deployment** (Fastest option: Railway or Render)
   ```bash
   # Railway.app deployment (simplest)
   railway login
   railway init
   railway up
   # Get your API URL
   ```

2. **Simple Database** (2 hours)
   - Use Supabase free tier (instant setup)
   - Or PostgreSQL on Railway
   - Migrate from in-memory to real DB

3. **Update Extension** (1 hour)
   - Point to production API URL
   - Test everything still works

#### Landing Page (3 hours)
1. **Deploy landing/index.html to Vercel**
   - Just need email capture for now
   - Link to Chrome extension install
   - Simple value prop explanation

#### Beta Access (5 hours)
1. **Private Chrome Web Store Listing**
   - Upload as unlisted extension
   - Share link with beta testers only
   - Skip full review process for now

2. **Or: Direct Installation**
   - Zip the extension folder
   - Share with testers to load unpacked
   - Faster but less convenient

### Phase 3: First 10 Users (Hours 24-48) 📊 Get Feedback
**Objective**: Learn what's broken and what users actually want

#### User Onboarding (6 hours)
1. **Simple Onboarding**
   - Add first-run popup explaining how to use
   - Create 1-minute Loom video demo
   - Add help tooltips in extension

2. **Free Premium Access**
   - Give all beta users Pro features free
   - Remove payment flow complexity for now
   - Focus on core value validation

#### Feedback Loop (8 hours)
1. **Add Analytics** (Quick wins)
   ```javascript
   // Add to content scripts
   trackEvent('profile_scored', {score: 85})
   trackEvent('message_generated')
   trackEvent('message_copied')
   ```

2. **User Interviews**
   - Schedule 15-min calls with each user
   - Watch them use it live (share screen)
   - Ask: "What would make you pay $20/month for this?"

#### Critical Monitoring (4 hours)
1. **Error Tracking**
   - Add Sentry (free tier)
   - Log all API failures
   - Monitor extension crashes

2. **Usage Dashboard**
   - Simple admin endpoint to see:
   - Total profiles scored
   - Messages generated
   - Active users today

### Phase 4: Iterate Based on Feedback (Day 3-7) 🔄
**Only After Getting Real User Feedback**

1. **Fix Top 3 User Complaints**
2. **Add Most Requested Feature**
3. **Then Add Payments** (Stripe integration)
4. **Public Chrome Web Store Launch**

---

## 🚨 DO NOT BUILD THESE YET
(Tempting but not needed for MVP)
- Team features
- CRM integration  
- Analytics dashboard
- Multiple message templates
- Bulk operations
- Email notifications
- Advanced filtering
- Chrome sync
- Mobile app
- API for developers

---

## 📋 Success Metrics for MVP
✅ 10 users have installed extension
✅ 100 profiles scored total
✅ 20 messages generated
✅ 3 users say they'd pay for it
✅ 1 user uses it daily for 3 days

---

## 🎯 Daily Checklist

### Day 1 (Today)
- [ ] Morning: Get backend running locally
- [ ] Afternoon: Test extension on LinkedIn
- [ ] Evening: Deploy backend to cloud

### Day 2 (Tomorrow)  
- [ ] Morning: Fix critical bugs found
- [ ] Afternoon: Share with 3 friends
- [ ] Evening: Implement their feedback

### Day 3
- [ ] Morning: Share with 10 beta users
- [ ] All day: User interviews & fixes

### Day 4-7
- [ ] Iterate based on feedback
- [ ] Add payment only if users asking
- [ ] Prepare for public launch

---

## 💡 Remember
- Ship embarrassingly early
- Talk to users more than coding
- Perfect is the enemy of shipped
- You can always improve later
- First version just needs to show value