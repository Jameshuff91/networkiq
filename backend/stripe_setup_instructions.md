# Stripe Setup Instructions for NetworkIQ

## 1. Get Your Stripe API Keys

1. Go to https://dashboard.stripe.com/test/apikeys
2. Copy your **Secret key** (starts with `sk_test_`)
3. Copy your **Publishable key** (starts with `pk_test_`)

## 2. Update Your .env File

Add your Stripe secret key to `backend/.env`:
```
STRIPE_SECRET_KEY=sk_test_YOUR_KEY_HERE
```

## 3. Run the Setup Script

Once you've added your Stripe secret key to .env, run:

```bash
cd backend
python setup_stripe.py
```

This will create:
- NetworkIQ Pro subscription ($19/month)
- NetworkIQ Free tier ($0/month for tracking)

## 4. Set Up Webhook (After Deployment)

After you deploy your backend, you'll need to:

1. Go to https://dashboard.stripe.com/test/webhooks
2. Click "Add endpoint"
3. Enter your endpoint URL: `https://YOUR-BACKEND-URL/api/payments/webhook`
4. Select events:
   - `checkout.session.completed`
   - `customer.subscription.deleted`
   - `customer.subscription.updated`
5. Copy the Signing secret (starts with `whsec_`)
6. Add to your .env: `STRIPE_WEBHOOK_SECRET=whsec_YOUR_SECRET`

## 5. Test the Integration

### Test Checkout Flow:
```bash
# Create a test checkout session
curl -X POST http://localhost:8000/api/payments/create-checkout \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{"success_url": "http://localhost:3000/success", "cancel_url": "http://localhost:3000/cancel"}'
```

### Test Card Numbers:
- Success: `4242 4242 4242 4242`
- Decline: `4000 0000 0000 0002`
- Requires auth: `4000 0025 0000 3155`

## 6. Switch to Live Mode (When Ready)

When ready for real payments:
1. Get your live API keys from https://dashboard.stripe.com/apikeys
2. Update .env with live keys (they start with `sk_live_` and `pk_live_`)
3. Create products in live mode
4. Update webhook with live endpoint

## Current Status Checklist

- [ ] Stripe account created
- [ ] Test API keys obtained
- [ ] Secret key added to .env
- [ ] Products created with setup_stripe.py
- [ ] Price IDs added to .env
- [ ] Webhook configured (after deployment)
- [ ] Test payment successful