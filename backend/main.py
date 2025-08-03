"""
NetworkIQ Backend API
Fast, scalable API for Chrome extension
"""

from fastapi import FastAPI, HTTPException, Depends, Request, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
import stripe
import os
from datetime import datetime, timedelta
from typing import Optional, Dict
import json
import pickle
from pathlib import Path
from dotenv import load_dotenv
import openai
from pydantic import BaseModel, EmailStr
import jwt
from passlib.context import CryptContext
import hashlib
from resume_parser import parse_resume_file
from profile_analyzer import ProfileAnalyzer

# Load environment variables
load_dotenv()

# Initialize FastAPI
app = FastAPI(title="NetworkIQ API", version="1.0.0")

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "chrome-extension://*",
        "http://localhost:3000",
        "https://networkiq.ai",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configuration
STRIPE_SECRET_KEY = os.getenv("STRIPE_SECRET_KEY")
STRIPE_WEBHOOK_SECRET = os.getenv("STRIPE_WEBHOOK_SECRET")
STRIPE_PRICE_ID = os.getenv("STRIPE_PRICE_ID", "price_xxxxx")  # Your Stripe price ID
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")  # For intelligent profile analysis
JWT_SECRET = os.getenv("JWT_SECRET", "your-secret-key-change-this")
JWT_ALGORITHM = "HS256"
JWT_EXPIRATION_HOURS = 24 * 30  # 30 days

# Initialize services
stripe.api_key = STRIPE_SECRET_KEY
if OPENAI_API_KEY and not OPENAI_API_KEY.startswith("sk-test"):
    openai.api_key = OPENAI_API_KEY
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# In-memory storage with persistence
DATA_DIR = Path("data")
DATA_DIR.mkdir(exist_ok=True)


def load_db(name, default=None):
    """Load database from file"""
    file_path = DATA_DIR / f"{name}.pkl"
    if file_path.exists():
        try:
            with open(file_path, "rb") as f:
                return pickle.load(f)
        except Exception as e:
            print(f"Error loading {name}: {e}")
    return default if default is not None else {}


def save_db(name, data):
    """Save database to file"""
    file_path = DATA_DIR / f"{name}.pkl"
    try:
        with open(file_path, "wb") as f:
            pickle.dump(data, f)
    except Exception as e:
        print(f"Error saving {name}: {e}")


# Load existing data or initialize empty
users_db = load_db("users", {})
profiles_db = load_db("profiles", {})
messages_db = load_db("messages", {})
usage_db = load_db("usage", {})


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
    # Look up user by user_id
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
    # Check if user exists (search by email since users_db is now keyed by user_id)
    for uid, u in users_db.items():
        if u.get("email") == user_data.email:
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
        "created_at": datetime.utcnow().isoformat(),
    }
    users_db[user_id] = user  # Store by user_id for JWT lookups
    save_db("users", users_db)  # Persist data

    # Create access token
    access_token = create_access_token({"sub": user_id})

    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": {
            "id": user["id"],
            "email": user["email"],
            "name": user["name"],
            "subscription_tier": user["subscription_tier"],
        },
    }


@app.post("/api/auth/login")
async def login(user_data: UserLogin):
    """Login user"""
    # Check user exists (search by email since users_db is now keyed by user_id)
    user = None
    found_user_id = None
    for uid, u in users_db.items():
        if u.get("email") == user_data.email:
            user = u
            found_user_id = uid
            break

    if not user:
        raise HTTPException(status_code=401, detail="Invalid credentials")

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
            "subscription_tier": user["subscription_tier"],
        },
    }


@app.get("/api/auth/user")
async def get_user(current_user: dict = Depends(get_current_user)):
    """Get current user info"""
    return {
        "id": current_user["id"],
        "email": current_user["email"],
        "name": current_user["name"],
        "subscription_tier": current_user["subscription_tier"],
        "background": current_user.get("background", {}),
        "resume_data": current_user.get("resume_data", {}),
    }


@app.post("/api/resume/upload")
async def upload_resume(
    file: UploadFile = File(...), current_user: dict = Depends(get_current_user)
):
    """Upload and parse user's resume"""
    # Validate file type
    if not file.filename.lower().endswith((".pdf", ".docx", ".doc", ".txt")):
        raise HTTPException(
            status_code=400,
            detail="Invalid file type. Please upload PDF, DOCX, or TXT file",
        )

    # Read file content
    content = await file.read()

    # Parse resume
    try:
        parsed_data = parse_resume_file(content, file.filename)

        # Store parsed resume data in user profile
        user_email = current_user["email"]
        if user_email in users_db:
            users_db[user_email]["resume_data"] = parsed_data
            users_db[user_email]["background"] = {
                "companies": parsed_data.get("companies", []),
                "skills": parsed_data.get("skills", []),
                "education": parsed_data.get("education", []),
                "military": parsed_data.get("military_service"),
                "search_elements": parsed_data.get("search_elements", []),
            }
            save_db("users", users_db)

        return {
            "success": True,
            "message": "Resume uploaded and parsed successfully",
            "data": {
                "companies": parsed_data.get("companies", []),
                "skills": len(parsed_data.get("skills", [])),
                "education": parsed_data.get("education", []),
                "military": bool(parsed_data.get("military_service")),
                "search_elements": len(parsed_data.get("search_elements", [])),
            },
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to parse resume: {str(e)}")


@app.post("/api/profiles/score")
async def score_profile(
    profile: ProfileScore, current_user: dict = Depends(get_current_user)
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
        raise HTTPException(
            status_code=429,
            detail="Daily limit reached. Upgrade to Pro for unlimited scoring.",
        )

    # Calculate score dynamically based on user's resume
    score = 0
    breakdown = {}
    connections = []

    profile_text = json.dumps(profile.profile_data).lower()

    # Get user's search elements from their resume
    user_background = current_user.get("background", {})
    search_elements = user_background.get("search_elements", [])

    # If no resume uploaded, use some default matching
    if not search_elements:
        # Default scoring for users without resume
        if any(word in profile_text for word in ["ceo", "founder", "director", "vp"]):
            score += 20
            connections.append("Leadership Role")
        if any(
            word in profile_text for word in ["ai", "machine learning", "data science"]
        ):
            score += 15
            connections.append("AI/ML Background")
    else:
        # Dynamic scoring based on user's resume
        matched_elements = []

        for element in search_elements:
            # Check if this element matches the profile
            if element["value"].lower() in profile_text:
                score += element["weight"]
                matched_elements.append(element)

                # Add to breakdown by category
                category = element["category"]
                if category not in breakdown:
                    breakdown[category] = 0
                breakdown[category] += element["weight"]

                # Add to connections for display
                connections.append(element["display"])

        # Limit connections to top 3 for display
        connections = connections[:3]

        # Bonus points for multiple matches in same category
        if len(matched_elements) >= 3:
            score += 10  # Bonus for strong alignment
            connections.append("Strong Match")

    # Update usage
    daily_usage["scores"] += 1
    save_db("usage", usage_db)  # Persist usage

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
        "created_at": datetime.utcnow().isoformat(),
    }
    save_db("profiles", profiles_db)  # Persist profiles

    return {
        "profile_id": profile_id,
        "score": min(score, 100),
        "breakdown": breakdown,
        "connections": connections,
        "tier": (
            "platinum"
            if score >= 70
            else "gold" if score >= 50 else "silver" if score >= 30 else "bronze"
        ),
    }


@app.post("/api/profiles/analyze")
async def analyze_profile_llm(
    profile: ProfileScore, current_user: dict = Depends(get_current_user)
):
    """Analyze a LinkedIn profile using LLM for intelligent matching"""
    
    # Check if Gemini API is configured
    if not GEMINI_API_KEY:
        # Fallback to regular scoring if no API key
        return await score_profile(profile, current_user)
    
    # Check usage limits for free tier
    user_id = current_user["id"]
    today = datetime.utcnow().date().isoformat()
    
    if user_id not in usage_db:
        usage_db[user_id] = {}
    
    if today not in usage_db[user_id]:
        usage_db[user_id][today] = {"scores": 0, "messages": 0}
    
    daily_usage = usage_db[user_id][today]
    
    # Check limits based on tier
    user_tier = users_db.get(user_id, {}).get("tier", "free")
    if user_tier == "free" and daily_usage["scores"] >= 10:
        raise HTTPException(
            status_code=429,
            detail="Daily limit reached. Upgrade to Pro for unlimited scoring.",
        )
    
    # Get user's search elements from their resume
    user = users_db.get(user_id, {})
    search_elements = user.get("search_elements", [])
    
    if not search_elements:
        # No resume uploaded, use default scoring
        return await score_profile(profile, current_user)
    
    try:
        # Initialize the LLM analyzer
        analyzer = ProfileAnalyzer(api_key=GEMINI_API_KEY)
        
        # Analyze the profile
        analysis = analyzer.analyze_profile(
            profile_data=profile.profile_data,
            user_search_elements=search_elements
        )
        
        # Generate enhanced message
        message = analyzer.generate_enhanced_message(
            profile=profile.profile_data,
            analysis=analysis
        )
        
        # Track usage
        daily_usage["scores"] += 1
        save_db("usage", usage_db)
        
        # Store profile with enhanced analysis
        profile_id = f"profile_{len(profiles_db) + 1}"
        profiles_db[profile_id] = {
            "id": profile_id,
            "user_id": user_id,
            "url": profile.linkedin_url,
            "data": profile.profile_data,
            "score": analysis["score"],
            "tier": analysis["tier"],
            "matches": analysis["matches"],
            "insights": analysis.get("insights", []),
            "hidden_connections": analysis.get("hidden_connections", []),
            "recommendation": analysis.get("recommendation", ""),
            "message": message,
            "created_at": datetime.utcnow().isoformat(),
        }
        save_db("profiles", profiles_db)
        
        return {
            "profile_id": profile_id,
            "score": analysis["score"],
            "tier": analysis["tier"],
            "matches": analysis["matches"],
            "insights": analysis.get("insights", []),
            "hidden_connections": analysis.get("hidden_connections", []),
            "recommendation": analysis.get("recommendation", ""),
            "message": message,
        }
        
    except Exception as e:
        print(f"LLM analysis failed, falling back to basic scoring: {e}")
        # Fallback to basic scoring
        return await score_profile(profile, current_user)


@app.post("/api/messages/generate")
async def generate_message(
    message_data: MessageGenerate, current_user: dict = Depends(get_current_user)
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
            raise HTTPException(
                status_code=429,
                detail="Daily message limit reached. Upgrade to Pro for unlimited messages.",
            )

        daily_usage["messages"] += 1

    # Generate message (use OpenAI if available, otherwise use templates)
    try:
        profile = message_data.profile_data
        connections = message_data.score_data.get("connections", [])

        # Check if OpenAI key is valid
        if OPENAI_API_KEY and not OPENAI_API_KEY.startswith("sk-test"):
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
                    {
                        "role": "system",
                        "content": "You are an expert at writing personalized LinkedIn messages.",
                    },
                    {"role": "user", "content": prompt},
                ],
                max_tokens=100,
                temperature=0.7,
            )

            message_text = response.choices[0].message.content.strip()
        else:
            # Use template-based messages for testing
            name = profile.get("name", "there")
            company = profile.get("company", "your company")

            templates = [
                f"Hi {name}, I noticed we both {connections[0] if connections else 'share similar backgrounds'}. Would love to connect and exchange insights about {company}.",
                f"Hi {name}, your experience at {company} caught my attention. As someone with {connections[0] if connections else 'shared interests'}, I'd value connecting with you.",
                f"Hi {name}, I see we have {connections[0] if connections else 'common ground'}. Your work at {company} aligns with my interests. Let's connect!",
            ]

            # Pick template based on profile hash (consistent but varied)
            profile_hash = int(hashlib.md5(str(profile).encode()).hexdigest()[:8], 16)
            message_text = templates[profile_hash % len(templates)]

        # Store message
        message_id = f"msg_{len(messages_db) + 1}"
        messages_db[message_id] = {
            "id": message_id,
            "user_id": current_user["id"],
            "profile_data": profile,
            "message": message_text,
            "created_at": datetime.utcnow().isoformat(),
        }
        save_db("messages", messages_db)  # Persist messages

        return {
            "message_id": message_id,
            "message": message_text,
            "alternatives": [],  # Could generate multiple versions
            "credits_used": 1,
        }

    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Failed to generate message: {str(e)}"
        )


@app.post("/api/payments/create-checkout")
async def create_checkout(
    session_data: CheckoutSession, current_user: dict = Depends(get_current_user)
):
    """Create Stripe checkout session"""
    if not STRIPE_SECRET_KEY:
        raise HTTPException(
            status_code=503, detail="Payment system not configured. Contact support."
        )

    try:
        checkout_session = stripe.checkout.Session.create(
            payment_method_types=["card"],
            line_items=[
                {
                    "price": session_data.price_id or STRIPE_PRICE_ID,
                    "quantity": 1,
                }
            ],
            mode="subscription",
            success_url="https://networkiq.ai/success?session_id={CHECKOUT_SESSION_ID}",
            cancel_url="https://networkiq.ai/pricing",
            client_reference_id=current_user["id"],
            customer_email=current_user["email"],
            metadata={"user_id": current_user["id"]},
        )

        return {"checkout_url": checkout_session.url, "session_id": checkout_session.id}

    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/api/payments/webhook")
async def stripe_webhook(request: Request):
    """Handle Stripe webhook events"""
    payload = await request.body()
    sig_header = request.headers.get("stripe-signature")

    try:
        event = stripe.Webhook.construct_event(
            payload, sig_header, STRIPE_WEBHOOK_SECRET
        )
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid payload")
    except stripe.error.SignatureVerificationError:
        raise HTTPException(status_code=400, detail="Invalid signature")

    # Handle the event
    if event["type"] == "checkout.session.completed":
        session = event["data"]["object"]
        user_id = session["client_reference_id"]

        # Update user subscription
        for email, user in users_db.items():
            if user["id"] == user_id:
                user["subscription_tier"] = "pro"
                user["stripe_customer_id"] = session["customer"]
                user["stripe_subscription_id"] = session["subscription"]
                save_db("users", users_db)  # Persist user updates
                break

    elif event["type"] == "customer.subscription.deleted":
        subscription = event["data"]["object"]

        # Downgrade user
        for email, user in users_db.items():
            if user.get("stripe_subscription_id") == subscription["id"]:
                user["subscription_tier"] = "free"
                save_db("users", users_db)  # Persist user updates
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
        "daily_limit": 10 if current_user["subscription_tier"] == "free" else 999999,
    }


# Run with: uvicorn main:app --reload --port 8000
if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)
