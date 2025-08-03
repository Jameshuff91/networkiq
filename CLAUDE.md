# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

NetworkIQ is a Chrome extension that provides AI-powered LinkedIn networking intelligence. It scores LinkedIn profiles based on commonalities with the user's background and generates personalized connection messages.

## Architecture

### System Components
1. **Chrome Extension** (extension/): LinkedIn profile parser, scorer, and UI overlay
   - Content scripts inject UI into LinkedIn pages
   - Background service worker handles API communication
   - Popup provides settings and account management

2. **Backend API** (backend/): FastAPI server handling authentication, scoring, and payments
   - In-memory storage (development) - should be replaced with PostgreSQL/Supabase for production
   - Stripe integration for subscriptions
   - OpenAI GPT-4 integration for message generation

3. **Landing Page** (landing/): Marketing website for user acquisition

## Development Commands

### Backend Development
```bash
# Install dependencies
cd backend
pip install -r requirements.txt

# Run the backend server
python main.py
# or
uvicorn main:app --reload --port 8000

# The API will be available at http://localhost:8000
# API documentation at http://localhost:8000/docs
```

### Chrome Extension Development
```bash
# Load extension in Chrome:
# 1. Open chrome://extensions/
# 2. Enable "Developer mode"
# 3. Click "Load unpacked"
# 4. Select the extension/ directory

# No build process required - extension uses vanilla JavaScript
```

### Environment Setup
Create a `.env` file in the backend directory with:
```
STRIPE_SECRET_KEY=your_stripe_key
STRIPE_WEBHOOK_SECRET=your_webhook_secret
STRIPE_PRICE_ID=your_price_id
OPENAI_API_KEY=your_openai_key
JWT_SECRET=your_jwt_secret
```

## Key Implementation Details

### Scoring Algorithm (extension/content/scorer.js)
The scoring system evaluates profiles based on:
- Military connections (USAFA, veterans): 30-40 points
- Company connections (C3 AI, Big Tech): 25-40 points
- Role relevance (Product Management): 20 points
- Maximum score: 100

### API Authentication
- JWT-based authentication with 30-day expiration
- Bearer token in Authorization header
- User tiers: free (10 scores/day, 3 messages/day) and pro (unlimited)

### Stripe Integration
- Subscription-based pricing model
- Webhook handling for subscription lifecycle events
- Checkout session creation for payment flow

### Chrome Extension Content Scripts
- **parser.js**: Extracts profile data from LinkedIn DOM
- **scorer.js**: Calculates NetworkIQ score locally
- **ui.js**: Injects score overlay into LinkedIn interface
- **service_worker.js**: Handles API calls and authentication

## Production Considerations

1. **Database**: Current in-memory storage must be replaced with PostgreSQL or Supabase
2. **Security**: JWT_SECRET must be changed from default value
3. **Rate Limiting**: Implement proper rate limiting for API endpoints
4. **Error Handling**: Add comprehensive error handling and logging
5. **Testing**: No test suite exists - add unit and integration tests
6. **Chrome Web Store**: Extension needs icons (16x16, 32x32, 48x48, 128x128) before submission

## API Endpoints

- `POST /api/auth/signup`: Create new user account
- `POST /api/auth/login`: User authentication
- `GET /api/auth/user`: Get current user info
- `POST /api/profiles/score`: Score a LinkedIn profile
- `POST /api/messages/generate`: Generate personalized message
- `POST /api/payments/create-checkout`: Create Stripe checkout session
- `POST /api/payments/webhook`: Handle Stripe webhooks
- `GET /api/stats`: Get user usage statistics

## Common Tasks

### Adding New Scoring Criteria
1. Update scoring logic in backend/main.py:score_profile()
2. Update frontend scoring in extension/content/scorer.js
3. Ensure consistency between backend and frontend scoring

### Modifying Subscription Tiers
1. Update tier limits in backend/main.py (lines 209-210, 288-289)
2. Update Stripe price IDs in environment variables
3. Modify user tier checks throughout the codebase

### Debugging Chrome Extension
1. Open Chrome DevTools on LinkedIn page
2. Check Console for content script errors
3. Check chrome://extensions/ for service worker errors
4. Use chrome.storage.local to inspect stored data