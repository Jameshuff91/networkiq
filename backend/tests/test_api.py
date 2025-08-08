"""
Integration tests for NetworkIQ API
Run with: pytest test_api.py -v
"""

from fastapi.testclient import TestClient
import sys
from pathlib import Path
import pytest

# Add parent directory to path to import main
sys.path.insert(0, str(Path(__file__).parent.parent))
from main import app

client = TestClient(app)


class TestAPI:
    """Test suite for NetworkIQ API endpoints"""

    def test_root_endpoint(self):
        """Test root endpoint returns operational status"""
        response = client.get("/")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "operational"
        assert "NetworkIQ API" in data["message"]

    def test_signup_new_user(self):
        """Test user signup with valid data"""
        user_data = {
            "email": "test@example.com",
            "password": "TestPassword123!",
            "name": "Test User",
        }
        response = client.post("/api/auth/signup", json=user_data)

        # If user already exists, that's fine - just check it returns 400
        if response.status_code == 400:
            assert "already registered" in response.json()["detail"]
        else:
            # Otherwise it should be a successful signup
            assert response.status_code == 200
            data = response.json()
            assert "access_token" in data
            assert data["user"]["email"] == user_data["email"]
            assert data["user"]["subscription_tier"] == "free"

    def test_signup_duplicate_email(self):
        """Test signup with existing email fails"""
        user_data = {
            "email": "duplicate@example.com",
            "password": "TestPassword123!",
            "name": "Test User",
        }
        # First signup
        client.post("/api/auth/signup", json=user_data)
        # Second signup with same email
        response = client.post("/api/auth/signup", json=user_data)
        assert response.status_code == 400
        assert "already registered" in response.json()["detail"]

    def test_login_valid_credentials(self):
        """Test login with valid credentials"""
        # First create a user
        signup_data = {
            "email": "login@example.com",
            "password": "TestPassword123!",
            "name": "Login User",
        }
        client.post("/api/auth/signup", json=signup_data)

        # Then login
        login_data = {"email": "login@example.com", "password": "TestPassword123!"}
        response = client.post("/api/auth/login", json=login_data)
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert data["user"]["email"] == login_data["email"]

    def test_login_invalid_credentials(self):
        """Test login with invalid credentials fails"""
        login_data = {"email": "nonexistent@example.com", "password": "WrongPassword"}
        response = client.post("/api/auth/login", json=login_data)
        assert response.status_code == 401
        assert "Invalid credentials" in response.json()["detail"]

    def test_protected_endpoint_without_auth(self):
        """Test protected endpoint requires authentication"""
        response = client.get("/api/auth/user")
        assert response.status_code == 401
        assert "Not authenticated" in response.json()["detail"]

    def test_protected_endpoint_with_auth(self):
        """Test protected endpoint with valid token"""
        # Create user and get token (handle if user already exists)
        signup_data = {
            "email": "auth@example.com",
            "password": "TestPassword123!",
            "name": "Auth User",
        }
        signup_response = client.post("/api/auth/signup", json=signup_data)

        # Get token either from signup or login
        if signup_response.status_code == 400:
            # User exists, login instead
            login_response = client.post(
                "/api/auth/login",
                json={
                    "email": signup_data["email"],
                    "password": signup_data["password"],
                },
            )
            token = login_response.json()["access_token"]
        else:
            token = signup_response.json()["access_token"]

        # Access protected endpoint
        headers = {"Authorization": f"Bearer {token}"}
        response = client.get("/api/auth/user", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert data["email"] == signup_data["email"]

    def test_score_profile_requires_auth(self):
        """Test profile scoring requires authentication"""
        profile_data = {
            "linkedin_url": "https://linkedin.com/in/test",
            "profile_data": {"name": "Test User", "company": "Test Corp"},
        }
        response = client.post("/api/profiles/score", json=profile_data)
        assert response.status_code == 401

    def test_score_profile_with_auth(self):
        """Test profile scoring with authentication"""
        # Create user and get token (handle if user already exists)
        signup_data = {
            "email": "scorer@example.com",
            "password": "TestPassword123!",
            "name": "Scorer User",
        }
        signup_response = client.post("/api/auth/signup", json=signup_data)

        # Get token either from signup or login
        if signup_response.status_code == 400:
            # User exists, login instead
            login_response = client.post(
                "/api/auth/login",
                json={
                    "email": signup_data["email"],
                    "password": signup_data["password"],
                },
            )
            token = login_response.json()["access_token"]
        else:
            token = signup_response.json()["access_token"]

        # Score a profile
        profile_data = {
            "linkedin_url": "https://linkedin.com/in/test",
            "profile_data": {
                "name": "Test User",
                "company": "C3 AI",
                "title": "Product Manager",
                "description": "USAFA graduate working in AI",
            },
        }
        headers = {"Authorization": f"Bearer {token}"}
        response = client.post(
            "/api/profiles/score", json=profile_data, headers=headers
        )
        assert response.status_code == 200
        data = response.json()
        assert "score" in data
        assert "breakdown" in data
        assert "connections" in data
        assert data["score"] > 0  # Should have high score due to USAFA and C3 AI

    def test_message_generation_requires_auth(self):
        """Test message generation requires authentication"""
        message_data = {
            "profile_data": {"name": "Test User"},
            "score_data": {"connections": ["USAFA Alumni"]},
        }
        response = client.post("/api/messages/generate", json=message_data)
        assert response.status_code == 401

    def test_message_generation_with_auth(self):
        """Test message generation with authentication"""
        import os

        # Check if OpenAI API key is configured
        if not os.getenv("OPENAI_API_KEY"):
            pytest.skip("OpenAI API key not configured")

        # Create user and get token (handle if user already exists)
        signup_data = {
            "email": "messenger@example.com",
            "password": "TestPassword123!",
            "name": "Messenger User",
        }
        signup_response = client.post("/api/auth/signup", json=signup_data)

        # Get token either from signup or login
        if signup_response.status_code == 400:
            # User exists, login instead
            login_response = client.post(
                "/api/auth/login",
                json={
                    "email": signup_data["email"],
                    "password": signup_data["password"],
                },
            )
            token = login_response.json()["access_token"]
        else:
            token = signup_response.json()["access_token"]

        # Generate a message
        message_data = {
            "profile_data": {"name": "John Doe", "company": "Tech Corp"},
            "score_data": {"connections": ["USAFA Alumni", "Product Management"]},
        }
        headers = {"Authorization": f"Bearer {token}"}
        response = client.post(
            "/api/messages/generate", json=message_data, headers=headers
        )

        # The API might fail if OpenAI key is invalid/expired
        if response.status_code == 500:
            # Check if it's an OpenAI API error
            error_detail = response.json().get("detail", "")
            if "OpenAI" in error_detail or "API" in error_detail:
                pytest.skip(f"OpenAI API error: {error_detail}")

        assert response.status_code == 200
        data = response.json()
        assert "message" in data
        assert len(data["message"]) > 0
        assert "message_id" in data

    def test_stats_endpoint(self):
        """Test user statistics endpoint"""
        # Create user and get token (handle if user already exists)
        signup_data = {
            "email": "stats@example.com",
            "password": "TestPassword123!",
            "name": "Stats User",
        }
        signup_response = client.post("/api/auth/signup", json=signup_data)

        # Get token either from signup or login
        if signup_response.status_code == 400:
            # User exists, login instead
            login_response = client.post(
                "/api/auth/login",
                json={
                    "email": signup_data["email"],
                    "password": signup_data["password"],
                },
            )
            token = login_response.json()["access_token"]
        else:
            token = signup_response.json()["access_token"]

        # Get stats
        headers = {"Authorization": f"Bearer {token}"}
        response = client.get("/api/stats", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert "total_profiles_scored" in data
        assert "total_messages_generated" in data
        assert "subscription_tier" in data
        assert data["subscription_tier"] == "free"

    def test_rate_limiting_free_tier(self):
        """Test rate limiting for free tier users"""
        import time
        import os

        # Temporarily set environment to production to enable rate limiting
        original_env = os.environ.get("ENVIRONMENT")
        os.environ["ENVIRONMENT"] = "production"

        # Re-import main to pick up the environment change
        import importlib
        import main

        importlib.reload(main)

        # Create free user with unique email to avoid rate limit conflicts
        unique_email = f"ratelimit{int(time.time())}@example.com"
        signup_data = {
            "email": unique_email,
            "password": "TestPassword123!",
            "name": "Rate Limit User",
        }
        signup_response = client.post("/api/auth/signup", json=signup_data)

        # Get token either from signup or login
        if signup_response.status_code == 400:
            # User exists, login instead
            login_response = client.post(
                "/api/auth/login",
                json={
                    "email": signup_data["email"],
                    "password": signup_data["password"],
                },
            )
            token = login_response.json()["access_token"]
        else:
            token = signup_response.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        # Score profiles up to the limit
        profile_data = {
            "linkedin_url": "https://linkedin.com/in/test",
            "profile_data": {"name": "Test User", "company": "Test Corp"},
        }

        # Note: Default limit is 10 for free tier
        # We'll test that the 11th request fails
        for i in range(10):
            response = client.post(
                "/api/profiles/score", json=profile_data, headers=headers
            )
            assert response.status_code == 200

        # 11th request should fail
        response = client.post(
            "/api/profiles/score", json=profile_data, headers=headers
        )
        assert response.status_code == 429
        assert "Daily limit reached" in response.json()["detail"]

        # Restore original environment
        if original_env is None:
            os.environ.pop("ENVIRONMENT", None)
        else:
            os.environ["ENVIRONMENT"] = original_env
        importlib.reload(main)

    def test_invalid_email_format(self):
        """Test signup with invalid email format"""
        user_data = {
            "email": "not-an-email",
            "password": "TestPassword123!",
            "name": "Test User",
        }
        response = client.post("/api/auth/signup", json=user_data)
        assert response.status_code == 422  # Validation error

    def test_checkout_requires_stripe_config(self):
        """Test checkout endpoint requires Stripe configuration"""
        import os

        # Create user and get token (handle existing user)
        signup_data = {
            "email": "checkout@example.com",
            "password": "TestPassword123!",
            "name": "Checkout User",
        }
        signup_response = client.post("/api/auth/signup", json=signup_data)

        # Get token either from signup or login
        if signup_response.status_code == 400:
            # User exists, login instead
            login_response = client.post(
                "/api/auth/login",
                json={
                    "email": signup_data["email"],
                    "password": signup_data["password"],
                },
            )
            token = login_response.json()["access_token"]
        else:
            token = signup_response.json()["access_token"]

        # Try to create checkout session
        checkout_data = {"user_id": "test_user", "price_id": "price_test"}
        headers = {"Authorization": f"Bearer {token}"}
        response = client.post(
            "/api/payments/create-checkout", json=checkout_data, headers=headers
        )

        # If Stripe is configured, it should return 200 or specific error
        # If not configured, it should return 503
        if os.getenv("STRIPE_SECRET_KEY"):
            # Stripe is configured, might succeed or fail with specific error
            assert response.status_code in [
                200,
                400,
                404,
            ]  # Success or specific Stripe error
        else:
            # Stripe not configured
            assert response.status_code == 503  # Service unavailable


if __name__ == "__main__":
    # Run basic tests if executed directly
    test = TestAPI()
    test.test_root_endpoint()
    test.test_signup_new_user()
    print("✅ Basic tests passed! Run 'pytest test_api.py -v' for full test suite")
