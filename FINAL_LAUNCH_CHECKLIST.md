# 🚀 NetworkIQ Final Launch Checklist - Complete Setup Guide

## Current Status
✅ Code is production-ready, linted, and tested  
✅ Backend server runs locally  
✅ Extension works in test mode  
⏳ Need: API keys, deployment, and Chrome Web Store submission

---

## 📋 Day 1: Essential Services Setup (2-3 hours)

### 1. OpenAI API Key (15 minutes)
**Purpose**: Enable AI-powered message generation

1. **Create OpenAI Account**
   - Go to https://platform.openai.com/signup
   - Sign up with email or Google
   - Verify email address

2. **Add Payment Method**
   - Go to https://platform.openai.com/account/billing
   - Click "Add payment method"
   - Add credit card (they give $5 free credit for new accounts)
   - Set usage limit to $20/month to start

3. **Generate API Key**
   - Go to https://platform.openai.com/api-keys
   - Click "Create new secret key"
   - Name it: "NetworkIQ Production"
   - **COPY THE KEY IMMEDIATELY** (shown only once)
   - Save it in a secure password manager

4. **Test the Key**
   ```bash
   # Test OpenAI key works
   curl https://api.openai.com/v1/models \
     -H "Authorization: Bearer sk-YOUR-KEY-HERE"
   ```

### 2. Stripe Account Setup (45 minutes)
**Purpose**: Handle payments and subscriptions

1. **Create Stripe Account**
   - Go to https://dashboard.stripe.com/register
   - Enter email and create password
   - Select "United States" as country
   - Fill business details:
     - Business name: "NetworkIQ" or your company name
     - Business type: Individual/Sole Proprietor (easiest)
     - Industry: Software

2. **Complete Identity Verification**
   - Add your SSN/EIN (required for US)
   - Add bank account for payouts
   - Add personal address
   - Upload ID if requested

3. **Create Products & Pricing**
   ```
   Dashboard → Products → Add Product
   ```
   
   **Free Tier (Optional)**
   - Name: "NetworkIQ Free"
   - Description: "10 profile scores per day"
   - Price: $0/month
   
   **Pro Tier**
   - Name: "NetworkIQ Pro"
   - Description: "Unlimited scoring, AI messages, analytics"
   - Price: $19/month (or your chosen price)
   - Billing: Recurring monthly
   - Click "Create product"
   - **COPY THE PRICE ID** (starts with `price_`)

4. **Get API Keys**
   - Go to https://dashboard.stripe.com/apikeys
   - Copy "Publishable key" (starts with `pk_test_`)
   - Copy "Secret key" (starts with `sk_test_`)
   - Keep Test mode ON until ready for real payments

5. **Set Up Webhook** (for subscription events)
   - Go to https://dashboard.stripe.com/webhooks
   - Click "Add endpoint"
   - Endpoint URL: `https://YOUR-BACKEND-URL/api/payments/webhook`
   - Events to listen: 
     - `checkout.session.completed`
     - `customer.subscription.deleted`
   - Click "Add endpoint"
   - **COPY THE SIGNING SECRET** (starts with `whsec_`)

### 3. Chrome Developer Account (20 minutes)
**Purpose**: Publish extension to Chrome Web Store

1. **Create Developer Account**
   - Go to https://chrome.google.com/webstore/devconsole
   - Sign in with Google account
   - Pay one-time $5 registration fee
   - Fill developer details

2. **Prepare Extension Assets**
   Create these files in `extension/` folder:
   
   **Screenshots** (Required: 1280x800 or 640x400)
   - Screenshot 1: Extension popup view
   - Screenshot 2: LinkedIn profile with score badge
   - Screenshot 3: Message generation in action
   - Screenshot 4: History page
   - Screenshot 5: Settings/upgrade view
   
   **Store Listing Images**
   - Small tile: 440x280 PNG
   - Large tile: 920x680 PNG
   - Marquee: 1400x560 PNG (optional but recommended)
   
   **Icon**: Already have 128x128 icon ✅

3. **Write Store Description**
   ```
   SHORT DESCRIPTION (132 chars max):
   "AI-powered LinkedIn networking. See who's worth connecting with at a glance. Score profiles & generate personalized messages."

   DETAILED DESCRIPTION:
   NetworkIQ transforms your LinkedIn networking with AI-powered intelligence.

   🎯 KEY FEATURES:
   ✅ Smart Scoring - Instantly see connection value (0-100 score)
   ✅ AI Messages - Generate personalized connection requests
   ✅ Connection Insights - Find shared backgrounds (alumni, military, companies)
   ✅ Track Success - Monitor which messages get responses
   ✅ Export Data - Download your networking analytics

   🚀 HOW IT WORKS:
   1. Install NetworkIQ extension
   2. Browse LinkedIn profiles as usual
   3. See NetworkIQ scores on each profile
   4. Click to generate personalized messages
   5. Track your networking success

   💰 PRICING:
   • Free: 10 profile scores per day
   • Pro ($19/month): Unlimited scoring, AI messages, analytics

   🔒 PRIVACY FIRST:
   • No LinkedIn data stored
   • GDPR compliant
   • Secure authentication
   • Your data stays yours

   Perfect for: Job seekers, recruiters, sales professionals, and networkers.
   ```

---

## 📦 Day 2: Deployment (2-3 hours)

### 4. Deploy Backend to Railway (Recommended - 30 minutes)
**Purpose**: Get backend API online

1. **Prepare for Deployment**
   ```bash
   cd backend
   
   # Create Procfile
   echo "web: uvicorn main:app --host 0.0.0.0 --port \$PORT" > Procfile
   
   # Create runtime.txt
   echo "python-3.12" > runtime.txt
   
   # Update requirements.txt (ensure all deps listed)
   pip freeze > requirements.txt
   ```

2. **Deploy to Railway**
   - Go to https://railway.app
   - Sign up with GitHub
   - Click "New Project"
   - Select "Deploy from GitHub repo"
   - Select your `networkiq-extension` repo
   - Railway auto-detects Python app
   
3. **Set Environment Variables**
   In Railway dashboard → Variables:
   ```
   OPENAI_API_KEY=sk-your-openai-key
   JWT_SECRET=generate-random-32-char-string
   STRIPE_SECRET_KEY=sk_test_your_stripe_key
   STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret
   STRIPE_PRICE_ID=price_your_price_id
   ENVIRONMENT=production
   ```

4. **Get Production URL**
   - Railway provides URL like: `networkiq-production.up.railway.app`
   - Test it: `curl https://your-app.railway.app/`
   - Update Stripe webhook URL with this domain

### 5. Deploy Landing Page to Vercel (20 minutes)
**Purpose**: Marketing site for user acquisition

1. **Deploy to Vercel**
   - Go to https://vercel.com
   - Sign up with GitHub
   - Click "New Project"
   - Import `networkiq-extension` repo
   - Set root directory to `landing/`
   - Deploy

2. **Get Production URL**
   - Vercel provides: `networkiq.vercel.app`
   - Or add custom domain if you have one

### 6. Update Extension for Production (20 minutes)

1. **Update API URL**
   ```javascript
   // extension/background/service_worker.js
   const API_BASE_URL = 'https://your-railway-app.railway.app/api';
   ```

2. **Update Landing Page Links**
   ```javascript
   // extension/background/service_worker.js - line 26
   url: 'https://your-landing-page.vercel.app/welcome'
   ```

3. **Test Extension with Production Backend**
   - Reload extension in Chrome
   - Test signup/login
   - Test profile scoring
   - Test message generation

---

## 🎯 Day 3: Testing & Submission (2-3 hours)

### 7. End-to-End Testing Checklist

**Test Free Tier Flow**
- [ ] Install extension fresh
- [ ] Sign up for free account
- [ ] Score 10 profiles (verify limit works)
- [ ] Try 11th profile (should show upgrade prompt)
- [ ] Generate 3 messages (verify limit)
- [ ] Check history page shows all profiles

**Test Pro Tier Flow**
- [ ] Click upgrade button
- [ ] Complete Stripe checkout (use test card: 4242 4242 4242 4242)
- [ ] Verify subscription activated
- [ ] Score >10 profiles (no limit)
- [ ] Generate >3 messages (no limit)

**Test Core Features**
- [ ] Profile scoring on different LinkedIn profiles
- [ ] Message generation with AI
- [ ] Export profiles to CSV
- [ ] Settings persistence
- [ ] Logout/login flow

### 8. Submit to Chrome Web Store (30 minutes)

1. **Package Extension**
   ```bash
   # Remove any development files
   cd extension
   rm -rf .DS_Store *.log
   
   # Create ZIP
   zip -r networkiq-extension.zip . -x "*.git*"
   ```

2. **Submit for Review**
   - Go to https://chrome.google.com/webstore/devconsole
   - Click "New Item"
   - Upload ZIP file
   - Fill all required fields:
     - Title: "NetworkIQ - LinkedIn Intelligence"
     - Category: "Productivity" → "Workflow & Planning"
     - Language: English
     - Add all 5 screenshots
     - Add descriptions
     - Add privacy policy URL (create simple one)
   - Submit for review

3. **Review Timeline**
   - Google typically reviews in 1-3 business days
   - May request changes (usually minor)
   - Once approved, available immediately

### 9. Create Privacy Policy (Required - 15 minutes)
Create `privacy.html` on your landing page:

```html
<!DOCTYPE html>
<html>
<head><title>NetworkIQ Privacy Policy</title></head>
<body>
<h1>Privacy Policy</h1>
<p>Last updated: [Date]</p>

<h2>Data We Collect</h2>
<ul>
  <li>Email address (for authentication)</li>
  <li>LinkedIn profile URLs you score (not content)</li>
  <li>Usage statistics (scores, messages generated)</li>
</ul>

<h2>How We Use Data</h2>
<ul>
  <li>Provide NetworkIQ scoring service</li>
  <li>Generate personalized messages</li>
  <li>Track usage for billing</li>
  <li>Improve our service</li>
</ul>

<h2>Data Security</h2>
<p>We use industry-standard encryption. We never store LinkedIn profile content, only metadata and scores.</p>

<h2>Third Party Services</h2>
<ul>
  <li>Stripe: Payment processing</li>
  <li>OpenAI: Message generation</li>
</ul>

<h2>Your Rights</h2>
<p>You can request data deletion at any time by emailing support@networkiq.ai</p>

<h2>Contact</h2>
<p>Email: support@networkiq.ai</p>
</body>
</html>
```

---

## 🔥 Launch Day Checklist

### Morning (1 hour)
- [ ] Verify backend is running: `curl https://your-api.railway.app/`
- [ ] Test extension with real LinkedIn profile
- [ ] Make one real payment (then refund) to verify Stripe works
- [ ] Check Chrome Web Store listing is live

### Soft Launch (2 hours)
- [ ] Share with 5 trusted friends/colleagues
- [ ] Ask them to install and test
- [ ] Gather immediate feedback
- [ ] Fix any critical bugs

### Marketing Prep (1 hour)
- [ ] Write LinkedIn post announcing launch
- [ ] Prepare ProductHunt submission
- [ ] Draft email to network
- [ ] Create simple demo video (Loom)

---

## 💰 Cost Breakdown

**Monthly Costs**
- Railway hosting: Free tier (sufficient for <1000 users)
- Vercel hosting: Free tier
- OpenAI API: ~$5-20/month depending on usage
- Stripe: 2.9% + 30¢ per transaction
- Total: <$25/month until you scale

**One-Time Costs**
- Chrome Developer Account: $5
- Domain name (optional): $12/year

---

## 🚨 Common Issues & Solutions

**Extension won't load?**
- Check manifest.json is valid
- Ensure all icon files exist
- Check Chrome DevTools for errors

**API calls failing?**
- Verify Railway app is running
- Check CORS settings in backend
- Ensure API URL is correct in extension

**Stripe checkout not working?**
- Verify price ID is correct
- Check webhook endpoint is accessible
- Ensure test mode matches keys (test keys for test mode)

**OpenAI messages not generating?**
- Check API key has credits
- Verify key is set in Railway env vars
- Test key with curl command

---

## 📞 Support Resources

- **Stripe Support**: https://support.stripe.com
- **OpenAI Help**: https://help.openai.com
- **Chrome Web Store**: https://support.google.com/chrome_webstore
- **Railway Discord**: https://discord.gg/railway
- **Vercel Support**: https://vercel.com/support

---

## ✅ Success Metrics (First Week)

- [ ] 50+ extension installs
- [ ] 5+ paying customers
- [ ] <2% error rate
- [ ] 4+ star average rating
- [ ] 20%+ conversion from free to paid

---

## 🎯 You're 95% Done!

The hard part (building) is complete. These are just admin tasks. In 6-8 hours spread over 2-3 days, you'll have:
- Real users using your extension
- Money coming in via Stripe
- A scalable system ready for growth

**Remember**: Launch messy and iterate. Don't wait for perfection!