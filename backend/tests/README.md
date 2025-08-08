# NetworkIQ Test Suite

Comprehensive testing pipeline for the NetworkIQ LinkedIn profile scoring system.

## Directory Structure

```
tests/
├── pipeline/           # Core testing pipelines
│   ├── test_comprehensive_pipeline.py  # Full system test with mock data
│   └── test_real_profiles.py          # Real LinkedIn profile testing
├── reports/           # Generated test reports
│   └── *.json        # JSON test results
├── test_api.py       # API endpoint tests
├── test_profile.json # Sample profile data
└── run_tests.py      # Main test runner
```

## Running Tests

### Quick Start
```bash
# Run all tests
source ../venv/bin/activate
python run_tests.py

# Run specific test suite
python pipeline/test_real_profiles.py
```

### Test Suites

#### 1. Real Profile Testing (`pipeline/test_real_profiles.py`)
Tests actual LinkedIn profile scoring with real data:
- Validates LLM accuracy
- Checks for false positives
- Ensures NULL values are filtered
- Verifies company matching is exact
- Measures performance (avg ~2.2s per profile)

#### 2. Comprehensive Pipeline (`pipeline/test_comprehensive_pipeline.py`)
Full system test including:
- Resume parsing
- Profile scoring
- Batch processing
- Performance metrics

#### 3. API Tests (`test_api.py`)
Tests backend API endpoints:
- Authentication
- Profile scoring
- Message generation
- Resume upload

## Key Validations

### ✅ Correct Behavior
- **Company Matching**: Only matches EXACT companies from resume (not industry)
- **Education Matching**: Only matches SAME institution (Stanford ≠ Johns Hopkins)
- **NULL Handling**: Filters out NULL/empty values (confidence < 0.3)
- **Military Recognition**: Properly identifies service academies and military service
- **Location Matching**: Recognizes geographic areas appropriately

### ❌ Prevented Issues
- False positives between different universities
- NULL values counting toward scores
- Industry matching (e.g., "AI" matching any AI company)
- Low-confidence matches affecting scores

## Performance Benchmarks

- **Resume Parsing**: ~1.7s
- **Single Profile Scoring**: ~2.2s average
- **Batch Processing**: ~2.7s per profile in batch
- **Confidence Threshold**: 0.3 (filters low-confidence matches)

## Test Reports

Reports are saved to `reports/` directory with:
- Timestamp
- Performance metrics
- Validation results
- Score distribution
- Identified issues

## Adding New Tests

1. Add test profiles to `REAL_LINKEDIN_PROFILES` in `test_real_profiles.py`
2. Specify expected matches and tier
3. Run tests to validate scoring accuracy

## Requirements

- Python 3.9+
- Gemini API key (set in .env)
- Dependencies: `pip install -r ../requirements.txt`