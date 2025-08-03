"""
NetworkIQ Backend API
Fast, scalable API for Chrome extension
"""

from fastapi import FastAPI, HTTPException, Depends, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import stripe
import os
from datetime import datetime, timedelta
from typing import Optional, Dict, Any
import json
from dotenv import load_dotenv
import openai
from pydantic import BaseModel, EmailStr
import jwt
from passlib.context import CryptContext
import httpx

# Load environment variables
load_dotenv()

# Initialize FastAPI
app = FastAPI(title="NetworkIQ API", version="1.0.0")

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["chrome-extension://*", "http://localhost:3000", "https://networkiq.ai"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configuration
STRIPE_SECRET_KEY = os.getenv("STRIPE_SECRET_KEY")
STRIPE_WEBHOOK_SECRET = os.getenv("STRIPE_WEBHOOK_SECRET")
STRIPE_PRICE_ID = os.getenv("STRIPE_PRICE_ID", "price_xxxxx")  # Your Stripe price ID
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
JWT_SECRET = os.getenv("JWT_SECRET", "your-secret-key-change-this")
JWT_ALGORITHM = "HS256"
JWT_EXPIRATION_HOURS = 24 * 30  # 30 days

# Initialize services
stripe.api_key = STRIPE_SECRET_KEY
openai.api_key = OPENAI_API_KEY
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# In-memory storage (replace with database in production)
users_db = {}
profiles_db = {}
messages_db = {}
usage_db = {}

# Pydantic models
class UserSignup(BaseModel):
    email: EmailStr
    password: str
    name: Optional[str] = None
    background: Optional[Dict] = None

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class ProfileScore(BaseModel):
    linkedin_url: str
    profile_data: Dict
    user_background: Optional[Dict] = None

class MessageGenerate(BaseModel):
    profile_data: Dict
    score_data: Dict
    tone: str = "professional"
    purpose: str = "networking"

class CheckoutSession(BaseModel):
    user_id: str
    price_id: Optional[str] = None

# Authentication helpers
def create_access_token(data: dict):
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(hours=JWT_EXPIRATION_HOURS)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, JWT_SECRET, algorithm=JWT_ALGORITHM)

def verify_token(token: str):
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        return payload
    except jwt.PyJWTError:
        return None

def get_current_user(request: Request):
    token = request.headers.get("Authorization", "").replace("Bearer ", "")
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    payload = verify_token(token)
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid token")
    
    user_id = payload.get("sub")
    if user_id not in users_db:
        raise HTTPException(status_code=404, detail="User not found")
    
    return users_db[user_id]

# Routes
@app.get("/")
async def root():
    return {"message": "NetworkIQ API v1.0.0", "status": "operational"}

@app.post("/api/auth/signup")
async def signup(user_data: UserSignup):
    """Create new user account"""
    # Check if user exists
    if user_data.email in users_db:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # Hash password
    hashed_password = pwd_context.hash(user_data.password)
    
    # Create user
    user_id = f"user_{len(users_db) + 1}"
    user = {
        "id": user_id,
        "email": user_data.email,
        "name": user_data.name,
        "password": hashed_password,
        "background": user_data.background or {},
        "subscription_tier": "free",
        "created_at": datetime.utcnow().isoformat()
    }
    users_db[user_data.email] = user
    
    # Create access token
    access_token = create_access_token({"sub": user_id})
    
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": {
            "id": user["id"],
            "email": user["email"],
            "name": user["name"],
            "subscription_tier": user["subscription_tier"]
        }
    }

@app.post("/api/auth/login")
async def login(user_data: UserLogin):
    """Login user"""
    # Check user exists
    if user_data.email not in users_db:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    user = users_db[user_data.email]
    
    # Verify password
    if not pwd_context.verify(user_data.password, user["password"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    # Create access token
    access_token = create_access_token({"sub": user["id"]})
    
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": {
            "id": user["id"],
            "email": user["email"],
            "name": user["name"],
            "subscription_tier": user["subscription_tier"]
        }
    }

@app.get("/api/auth/user")
async def get_user(current_user: dict = Depends(get_current_user)):
    """Get current user info"""
    return {
        "id": current_user["id"],
        "email": current_user["email"],
        "name": current_user["name"],
        "subscription_tier": current_user["subscription_tier"],
        "background": current_user.get("background", {})
    }

@app.post("/api/profiles/score")
async def score_profile(
    profile: ProfileScore,
    current_user: dict = Depends(get_current_user)
):
    """Score a LinkedIn profile"""
    # Check usage limits for free tier
    user_id = current_user["id"]
    today = datetime.utcnow().date().isoformat()
    
    if user_id not in usage_db:
        usage_db[user_id] = {}
    
    if today not in usage_db[user_id]:
        usage_db[user_id][today] = {"scores": 0, "messages": 0}
    
    daily_usage = usage_db[user_id][today]
    
    if current_user["subscription_tier"] == "free" and daily_usage["scores"] >= 10:
        raise HTTPException(status_code=429, detail="Daily limit reached. Upgrade to Pro for unlimited scoring.")
    
    # Calculate score (simplified version)
    score = 0
    breakdown = {}
    connections = []
    
    profile_text = json.dumps(profile.profile_data).lower()
    
    # Military connections
    if "usafa" in profile_text or "air force academy" in profile_text:
        score += 40
        breakdown["military"] = 40
        connections.append("USAFA Alumni")
    elif any(word in profile_text for word in ["military", "veteran", "navy", "army"]):
        score += 30
        breakdown["military"] = 30
        connections.append("Military Veteran")
    
    # Company connections
    if "c3" in profile_text or "c3.ai" in profile_text:
        score += 40
        breakdown["company"] = 40
        connections.append("Former C3 AI Colleague")
    elif any(company in profile_text for company in ["anthropic", "openai", "google", "meta"]):
        score += 25
        breakdown["company"] = 25
        connections.append("Big Tech AI")
    
    # Role relevance
    if "product" in profile_text and "manager" in profile_text:
        score += 20
        breakdown["role"] = 20
        connections.append("Product Management")
    
    # Update usage
    daily_usage["scores"] += 1
    
    # Store profile
    profile_id = f"profile_{len(profiles_db) + 1}"
    profiles_db[profile_id] = {
        "id": profile_id,
        "user_id": user_id,
        "url": profile.linkedin_url,
        "data": profile.profile_data,
        "score": score,
        "breakdown": breakdown,
        "connections": connections,
        "created_at": datetime.utcnow().isoformat()
    }
    
    return {
        "profile_id": profile_id,
        "score": min(score, 100),
        "breakdown": breakdown,
        "connections": connections,
        "tier": "platinum" if score >= 70 else "gold" if score >= 50 else "silver" if score >= 30 else "bronze"
    }

@app.post("/api/messages/generate")
async def generate_message(
    message_data: MessageGenerate,
    current_user: dict = Depends(get_current_user)
):
    """Generate personalized LinkedIn message"""
    # Check if user is Pro
    if current_user["subscription_tier"] == "free":
        # Check daily limit
        user_id = current_user["id"]
        today = datetime.utcnow().date().isoformat()
        
        if user_id not in usage_db:
            usage_db[user_id] = {}
        if today not in usage_db[user_id]:
            usage_db[user_id][today] = {"scores": 0, "messages": 0}
        
        daily_usage = usage_db[user_id][today]
        
        if daily_usage["messages"] >= 3:
            raise HTTPException(status_code=429, detail="Daily message limit reached. Upgrade to Pro for unlimited messages.")
        
        daily_usage["messages"] += 1
    
    # Generate message with OpenAI
    try:
        profile = message_data.profile_data
        connections = message_data.score_data.get("connections", [])
        
        prompt = f"""
        Create a personalized LinkedIn connection request message.
        
        Profile: {profile.get('name')} at {profile.get('company')}
        Title: {profile.get('title')}
        Shared connections: {', '.join(connections)}
        
        Write a brief, warm message (under 280 characters) that references shared background.
        Be authentic and specific. Don't be salesy.
        """
        
        response = openai.ChatCompletion.create(
            model="gpt-4",
            messages=[
                {"role": "system", "content": "You are an expert at writing personalized LinkedIn messages."},
                {"role": "user", "content": prompt}
            ],
            max_tokens=100,
            temperature=0.7
        )
        
        message_text = response.choices[0].message.content.strip()
        
        # Store message
        message_id = f"msg_{len(messages_db) + 1}"
        messages_db[message_id] = {
            "id": message_id,
            "user_id": current_user["id"],
            "profile_data": profile,
            "message": message_text,
            "created_at": datetime.utcnow().isoformat()
        }
        
        return {
            "message_id": message_id,
            "message": message_text,
            "alternatives": [],  # Could generate multiple versions
            "credits_used": 1
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate message: {str(e)}")

@app.post("/api/payments/create-checkout")
async def create_checkout(
    session_data: CheckoutSession,
    current_user: dict = Depends(get_current_user)
):
    """Create Stripe checkout session"""
    try:
        checkout_session = stripe.checkout.Session.create(
            payment_method_types=['card'],
            line_items=[{
                'price': session_data.price_id or STRIPE_PRICE_ID,
                'quantity': 1,
            }],
            mode='subscription',
            success_url='https://networkiq.ai/success?session_id={CHECKOUT_SESSION_ID}',
            cancel_url='https://networkiq.ai/pricing',
            client_reference_id=current_user["id"],
            customer_email=current_user["email"],
            metadata={
                'user_id': current_user["id"]
            }
        )
        
        return {
            "checkout_url": checkout_session.url,
            "session_id": checkout_session.id
        }
        
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/api/payments/webhook")
async def stripe_webhook(request: Request):
    """Handle Stripe webhook events"""
    payload = await request.body()
    sig_header = request.headers.get('stripe-signature')
    
    try:
        event = stripe.Webhook.construct_event(
            payload, sig_header, STRIPE_WEBHOOK_SECRET
        )
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid payload")
    except stripe.error.SignatureVerificationError:
        raise HTTPException(status_code=400, detail="Invalid signature")
    
    # Handle the event
    if event['type'] == 'checkout.session.completed':
        session = event['data']['object']
        user_id = session['client_reference_id']
        
        # Update user subscription
        for email, user in users_db.items():
            if user["id"] == user_id:
                user["subscription_tier"] = "pro"
                user["stripe_customer_id"] = session['customer']
                user["stripe_subscription_id"] = session['subscription']
                break
    
    elif event['type'] == 'customer.subscription.deleted':
        subscription = event['data']['object']
        
        # Downgrade user
        for email, user in users_db.items():
            if user.get("stripe_subscription_id") == subscription['id']:
                user["subscription_tier"] = "free"
                break
    
    return {"status": "success"}

@app.get("/api/stats")
async def get_stats(current_user: dict = Depends(get_current_user)):
    """Get user statistics"""
    user_id = current_user["id"]
    
    # Count profiles scored
    user_profiles = [p for p in profiles_db.values() if p["user_id"] == user_id]
    
    # Count messages
    user_messages = [m for m in messages_db.values() if m["user_id"] == user_id]
    
    # Get today's usage
    today = datetime.utcnow().date().isoformat()
    today_usage = usage_db.get(user_id, {}).get(today, {"scores": 0, "messages": 0})
    
    return {
        "total_profiles_scored": len(user_profiles),
        "total_messages_generated": len(user_messages),
        "today_scores": today_usage["scores"],
        "today_messages": today_usage["messages"],
        "subscription_tier": current_user["subscription_tier"],
        "daily_limit": 10 if current_user["subscription_tier"] == "free" else 999999
    }

# Run with: uvicorn main:app --reload --port 8000
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)