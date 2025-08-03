#!/usr/bin/env python3
"""
Setup Stripe products and pricing for NetworkIQ
Run this once to create your products in Stripe
"""

import stripe
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Initialize Stripe with your secret key
stripe.api_key = os.getenv("STRIPE_SECRET_KEY")

if not stripe.api_key:
    print("❌ Error: STRIPE_SECRET_KEY not found in .env file")
    print("Please add your Stripe secret key to backend/.env")
    exit(1)

print("🚀 Setting up Stripe products for NetworkIQ...")

try:
    # Create the Pro subscription product
    pro_product = stripe.Product.create(
        name="NetworkIQ Pro",
        description="Unlimited LinkedIn profile scoring, AI-powered messages, and advanced analytics",
        metadata={
            "tier": "pro",
            "features": "unlimited_scores,ai_messages,analytics,export",
        },
    )
    print(f"✅ Created product: {pro_product.name} (ID: {pro_product.id})")

    # Create the monthly price for Pro
    pro_price = stripe.Price.create(
        product=pro_product.id,
        unit_amount=1900,  # $19.00 in cents
        currency="usd",
        recurring={"interval": "month"},
        nickname="NetworkIQ Pro Monthly",
        metadata={"tier": "pro", "billing": "monthly"},
    )
    print(
        f"✅ Created price: ${pro_price.unit_amount/100:.2f}/month (ID: {pro_price.id})"
    )

    # Optional: Create a Free tier product (for tracking)
    free_product = stripe.Product.create(
        name="NetworkIQ Free",
        description="10 profile scores per day, 3 AI messages per day",
        metadata={"tier": "free", "features": "limited_scores,limited_messages"},
    )
    print(f"✅ Created product: {free_product.name} (ID: {free_product.id})")

    # Create a $0 price for the free tier (optional, for record-keeping)
    free_price = stripe.Price.create(
        product=free_product.id,
        unit_amount=0,
        currency="usd",
        recurring={"interval": "month"},
        nickname="NetworkIQ Free",
        metadata={"tier": "free", "billing": "monthly"},
    )
    print(
        f"✅ Created price: ${free_price.unit_amount/100:.2f}/month (ID: {free_price.id})"
    )

    # Print summary
    print("\n" + "=" * 60)
    print("🎉 STRIPE SETUP COMPLETE!")
    print("=" * 60)
    print("\n📝 Add these to your backend/.env file:\n")
    print(f"STRIPE_PRICE_ID={pro_price.id}")
    print(f"STRIPE_PRODUCT_ID={pro_product.id}")
    print(f"STRIPE_FREE_PRICE_ID={free_price.id}  # Optional")
    print("\n💡 Next steps:")
    print("1. Copy the STRIPE_PRICE_ID to your .env file")
    print("2. Set up webhook endpoint in Stripe Dashboard")
    print("3. Test the checkout flow")

    # Also save to a file for reference
    with open("stripe_config.txt", "w") as f:
        f.write(f"# Stripe Configuration for NetworkIQ\n")
        f.write(
            f"# Created: {stripe.util.convert_to_stripe_object(pro_product.created, None, None)}\n\n"
        )
        f.write(f"# Pro Subscription\n")
        f.write(f"STRIPE_PRICE_ID={pro_price.id}\n")
        f.write(f"STRIPE_PRODUCT_ID={pro_product.id}\n\n")
        f.write(f"# Free Tier (optional)\n")
        f.write(f"STRIPE_FREE_PRICE_ID={free_price.id}\n")
        f.write(f"STRIPE_FREE_PRODUCT_ID={free_product.id}\n")

    print("\n📄 Configuration also saved to: backend/stripe_config.txt")

except stripe.error.AuthenticationError:
    print("❌ Authentication failed. Please check your STRIPE_SECRET_KEY")
    print("Make sure you're using the correct key (test or live)")
except stripe.error.StripeError as e:
    print(f"❌ Stripe error: {e}")
except Exception as e:
    print(f"❌ Unexpected error: {e}")
