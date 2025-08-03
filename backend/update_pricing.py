#!/usr/bin/env python3
"""
Update NetworkIQ pricing to have Basic ($5) and Advanced ($20) tiers
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
    exit(1)

print("🚀 Creating new NetworkIQ pricing tiers...")

try:
    # Create Basic Plan Product
    basic_product = stripe.Product.create(
        name="NetworkIQ Basic",
        description="Essential LinkedIn networking tools - 50 profile scores/day, 10 AI messages/day",
        metadata={
            "tier": "basic",
            "features": "50_scores_daily,10_messages_daily,basic_analytics",
        },
    )
    print(f"✅ Created product: {basic_product.name} (ID: {basic_product.id})")

    # Create Basic Plan Price ($5/month)
    basic_price = stripe.Price.create(
        product=basic_product.id,
        unit_amount=500,  # $5.00 in cents
        currency="usd",
        recurring={"interval": "month"},
        nickname="NetworkIQ Basic Monthly",
        metadata={"tier": "basic", "billing": "monthly"},
    )
    print(
        f"✅ Created price: ${basic_price.unit_amount/100:.2f}/month (ID: {basic_price.id})"
    )

    # Create Advanced Plan Product
    advanced_product = stripe.Product.create(
        name="NetworkIQ Advanced",
        description="Unlimited LinkedIn networking - Unlimited scores, unlimited AI messages, export data, priority support",
        metadata={
            "tier": "advanced",
            "features": "unlimited_scores,unlimited_messages,advanced_analytics,export,priority_support",
        },
    )
    print(f"✅ Created product: {advanced_product.name} (ID: {advanced_product.id})")

    # Create Advanced Plan Price ($20/month)
    advanced_price = stripe.Price.create(
        product=advanced_product.id,
        unit_amount=2000,  # $20.00 in cents
        currency="usd",
        recurring={"interval": "month"},
        nickname="NetworkIQ Advanced Monthly",
        metadata={"tier": "advanced", "billing": "monthly"},
    )
    print(
        f"✅ Created price: ${advanced_price.unit_amount/100:.2f}/month (ID: {advanced_price.id})"
    )

    # Also update the Free tier description
    free_product = stripe.Product.create(
        name="NetworkIQ Free",
        description="Get started free - 10 profile scores/day, 3 AI messages/day",
        metadata={"tier": "free", "features": "10_scores_daily,3_messages_daily"},
    )
    print(f"✅ Created product: {free_product.name} (ID: {free_product.id})")

    # Print summary
    print("\n" + "=" * 60)
    print("🎉 NEW PRICING STRUCTURE COMPLETE!")
    print("=" * 60)
    print("\n📊 Pricing Tiers:")
    print("  • FREE:     10 scores/day,  3 messages/day")
    print("  • BASIC:    50 scores/day,  10 messages/day  - $5/month")
    print("  • ADVANCED: Unlimited everything              - $20/month")

    print("\n📝 Add these to your backend/.env file:\n")
    print(f"# Pricing Tiers")
    print(f"STRIPE_BASIC_PRICE_ID={basic_price.id}")
    print(f"STRIPE_ADVANCED_PRICE_ID={advanced_price.id}")
    print(f"")
    print(f"# Product IDs")
    print(f"STRIPE_BASIC_PRODUCT_ID={basic_product.id}")
    print(f"STRIPE_ADVANCED_PRODUCT_ID={advanced_product.id}")

    # Save to file for reference
    with open("new_pricing_config.txt", "w") as f:
        f.write(f"# NetworkIQ Pricing Configuration\n")
        f.write(f"# Generated for new tier structure\n\n")
        f.write(f"# Basic Tier ($5/month)\n")
        f.write(f"STRIPE_BASIC_PRICE_ID={basic_price.id}\n")
        f.write(f"STRIPE_BASIC_PRODUCT_ID={basic_product.id}\n\n")
        f.write(f"# Advanced Tier ($20/month)\n")
        f.write(f"STRIPE_ADVANCED_PRICE_ID={advanced_price.id}\n")
        f.write(f"STRIPE_ADVANCED_PRODUCT_ID={advanced_product.id}\n\n")
        f.write(f"# Free Tier\n")
        f.write(f"STRIPE_FREE_PRODUCT_ID={free_product.id}\n")

    print("\n📄 Configuration saved to: backend/new_pricing_config.txt")
    print("\n💡 Next steps:")
    print("1. Update backend/main.py to handle multiple tiers")
    print("2. Update extension UI to show tier options")
    print("3. Test upgrade flow from Free → Basic → Advanced")

except stripe.error.StripeError as e:
    print(f"❌ Stripe error: {e}")
except Exception as e:
    print(f"❌ Unexpected error: {e}")
