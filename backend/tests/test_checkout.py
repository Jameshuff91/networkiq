#!/usr/bin/env python3
"""
Test Stripe checkout creation directly
"""

import stripe
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Initialize Stripe
stripe.api_key = os.getenv("STRIPE_SECRET_KEY")
price_id = os.getenv("STRIPE_PRICE_ID")

print("🧪 Testing Stripe Checkout Session Creation...")
print(f"Using Price ID: {price_id}")

try:
    # Create a checkout session
    checkout_session = stripe.checkout.Session.create(
        payment_method_types=["card"],
        line_items=[
            {
                "price": price_id,
                "quantity": 1,
            }
        ],
        mode="subscription",
        success_url="http://localhost:8000/success?session_id={CHECKOUT_SESSION_ID}",
        cancel_url="http://localhost:8000/cancel",
        client_reference_id="test_user_123",
        customer_email="test@example.com",
        metadata={"user_id": "test_user_123", "tier": "pro"},
    )

    print(f"\n✅ Checkout session created successfully!")
    print(f"\n🔗 Checkout URL (copy and paste in browser):\n")
    print(f"{checkout_session.url}")
    print(f"\n📝 Session ID: {checkout_session.id}")
    print(f"\n💡 This is a TEST mode checkout - use card 4242 4242 4242 4242")

except stripe.error.StripeError as e:
    print(f"❌ Stripe error: {e}")
except Exception as e:
    print(f"❌ Error: {e}")
