#!/usr/bin/env python3
"""
Test Stripe connection and list existing products
"""

import stripe
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Initialize Stripe
stripe.api_key = os.getenv("STRIPE_SECRET_KEY")

if not stripe.api_key:
    print("❌ STRIPE_SECRET_KEY not found in .env")
    print("\n📝 To fix this:")
    print("1. Go to https://dashboard.stripe.com/test/apikeys")
    print("2. Copy your Secret key (starts with sk_test_)")
    print("3. Add to backend/.env:")
    print("   STRIPE_SECRET_KEY=sk_test_YOUR_KEY_HERE")
    exit(1)

print("🔍 Testing Stripe connection...")

try:
    # Test the connection by listing products
    products = stripe.Product.list(limit=10)

    if products.data:
        print(f"✅ Connection successful! Found {len(products.data)} products:\n")
        for product in products.data:
            print(f"  - {product.name} (ID: {product.id})")
            # List prices for this product
            prices = stripe.Price.list(product=product.id, limit=5)
            for price in prices.data:
                amount = price.unit_amount / 100 if price.unit_amount else 0
                interval = price.recurring.interval if price.recurring else "one-time"
                print(f"    └─ ${amount:.2f}/{interval} (Price ID: {price.id})")
    else:
        print("✅ Connection successful! No products found yet.")
        print("\n💡 Run 'python setup_stripe.py' to create NetworkIQ products")

    # Check account details
    account = stripe.Account.retrieve()
    print(f"\n📊 Account Details:")
    print(f"  - Account ID: {account.id}")
    print(f"  - Email: {account.email}")
    print(f"  - Country: {account.country}")

    # Check if in test mode
    if stripe.api_key.startswith("sk_test_"):
        print("\n⚠️  Using TEST mode - no real charges will occur")
    else:
        print("\n💰 Using LIVE mode - real charges will occur!")

except stripe.error.AuthenticationError:
    print("❌ Authentication failed!")
    print("Your API key is invalid or expired.")
    print("\nPlease check:")
    print(
        "1. You're using the correct key from https://dashboard.stripe.com/test/apikeys"
    )
    print("2. The key is properly copied (no extra spaces)")
    print("3. You're logged into the correct Stripe account")

except stripe.error.PermissionError:
    print("❌ Permission denied!")
    print("Your API key doesn't have permission for this operation.")

except Exception as e:
    print(f"❌ Error: {e}")
    print("\nTroubleshooting:")
    print("1. Check your internet connection")
    print("2. Verify Stripe service status at https://status.stripe.com")
    print("3. Ensure your API key is correct")
