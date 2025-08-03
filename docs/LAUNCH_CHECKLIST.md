# NetworkIQ Launch Checklist

## 🚀 7-Day Launch Plan

### Day 1-2: Development Setup ✅
- [x] Chrome extension structure
- [x] Profile parser
- [x] Scoring algorithm
- [x] UI overlay
- [x] Backend API structure
- [x] Database schema
- [ ] Test with 5 real LinkedIn profiles

### Day 3: Backend & Payment
- [ ] Set up Supabase account (free tier)
- [ ] Configure Stripe account
- [ ] Create products in Stripe:
  - Pro Monthly: $19 (early bird $9)
  - Team Monthly: $49
- [ ] Deploy backend to Vercel
- [ ] Test payment flow end-to-end

### Day 4: Polish & Testing
- [ ] Extension icon design
- [ ] Landing page screenshots
- [ ] Test on 10 different LinkedIn profiles
- [ ] Fix edge cases
- [ ] Add error handling

### Day 5: Chrome Web Store
- [ ] Create developer account ($5 one-time)
- [ ] Prepare store assets:
  - [ ] Icon (128x128)
  - [ ] Screenshots (1280x800)
  - [ ] Promotional tile (440x280)
  - [ ] Description (max 132 chars)
- [ ] Submit for review

### Day 6: Marketing Prep
- [ ] Landing page live on Vercel
- [ ] Set up analytics (PostHog free tier)
- [ ] Create demo video (2 min)
- [ ] Write ProductHunt post
- [ ] Prepare LinkedIn posts

### Day 7: Launch! 🎉
- [ ] Publish to Chrome Web Store
- [ ] ProductHunt launch
- [ ] Post in communities:
  - [ ] LinkedIn (ironic but effective)
  - [ ] Military veteran groups
  - [ ] University alumni groups
  - [ ] Indie Hackers
- [ ] Email 10 potential users

## 📋 Pre-Launch Setup

### Accounts Needed
1. **Supabase** (Database)
   - Go to: https://supabase.com
   - Create project
   - Get URL and anon key
   - Run migrations

2. **Stripe** (Payments)
   - Go to: https://stripe.com
   - Create account
   - Add products and prices
   - Get API keys
   - Set up webhook

3. **Vercel** (Hosting)
   - Go to: https://vercel.com
   - Connect GitHub repo
   - Deploy backend and landing

4. **Chrome Developer**
   - Go to: https://chrome.google.com/webstore/devconsole
   - Pay $5 fee
   - Verify account

5. **OpenAI** (AI Messages)
   - Go to: https://platform.openai.com
   - Get API key
   - Add $20 credits

## 🔧 Technical Setup

### Environment Variables
```bash
# Backend (.env)
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_KEY=xxx
STRIPE_SECRET_KEY=sk_test_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx
OPENAI_API_KEY=sk-xxx
JWT_SECRET=random-string-here
```

### Database Setup
```sql
-- Run in Supabase SQL editor
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255),
    subscription_tier VARCHAR(50) DEFAULT 'free',
    stripe_customer_id VARCHAR(255),
    created_at TIMESTAMP DEFAULT NOW()
);

-- Add other tables from schema
```

### Stripe Products
```javascript
// Create in Stripe Dashboard
Product: NetworkIQ Pro
Price: $19/month (price_xxx)
Trial: 7 days free

Product: NetworkIQ Team  
Price: $49/user/month (price_yyy)
Trial: 7 days free
```

## 📊 Launch Metrics

### Day 1 Goals
- [ ] 10 installs
- [ ] 1 paid user
- [ ] 5 testimonials

### Week 1 Goals
- [ ] 100 installs
- [ ] 10 paid users ($90 MRR)
- [ ] 20% free→paid conversion

### Month 1 Goals
- [ ] 500 installs
- [ ] 50 paid users ($450 MRR)
- [ ] ProductHunt #5 or better

## 🎯 Marketing Messages

### Tagline Options
1. "See who's worth connecting with at a glance"
2. "Network smarter, not harder on LinkedIn"
3. "AI-powered networking intelligence"

### Value Props
- 30% higher connection acceptance rate
- 80% time saved on outreach
- Personalized messages that work

### Target Audiences
1. **Military Veterans** - "Find fellow veterans in tech"
2. **University Alumni** - "Leverage your alumni network"
3. **Job Seekers** - "Get responses to cold outreach"
4. **Sales Pros** - "Personalization at scale"

## 🚨 Launch Day Tasks

### Morning (9 AM)
- [ ] Publish to Chrome Web Store
- [ ] Launch on ProductHunt
- [ ] Send to email list

### Midday (12 PM)
- [ ] Post on LinkedIn
- [ ] Share in Slack communities
- [ ] Tweet launch thread

### Evening (6 PM)
- [ ] Respond to feedback
- [ ] Fix any critical bugs
- [ ] Thank early users

## 📈 Post-Launch

### Week 1
- Gather feedback
- Fix bugs
- Add requested features
- Get testimonials

### Week 2
- Optimize onboarding
- A/B test pricing
- Reach out to press

### Month 1
- Launch referral program
- Add team features
- Explore partnerships

## 💡 Quick Wins

1. **First 10 Users**: Personal outreach to military veterans
2. **Social Proof**: Screenshot success stories
3. **Viral Loop**: "Powered by NetworkIQ" in messages
4. **Urgency**: "Early bird pricing ends soon"

## 🔗 Important Links

- GitHub Repo: /networkiq-extension
- Landing Page: https://networkiq.ai
- Chrome Store: [pending]
- Stripe Dashboard: https://dashboard.stripe.com
- Supabase Dashboard: https://app.supabase.com
- Analytics: https://app.posthog.com

## ✅ Final Checklist

Before hitting publish:
- [ ] Test payment flow with real card
- [ ] Verify free tier limits work
- [ ] Check all error messages
- [ ] Landing page mobile responsive
- [ ] Extension works on all LinkedIn pages
- [ ] Support email set up
- [ ] Privacy policy published
- [ ] Terms of service published

---

**Remember**: Launch imperfect and iterate. The goal is 10 paying users in Week 1!