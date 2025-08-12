#!/usr/bin/env python3
"""
Main test runner for NetworkIQ test suite
"""

import sys
import os
import subprocess
from pathlib import Path
from datetime import datetime

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


def run_test_suite(test_file: str, test_name: str) -> bool:
    """Run a single test suite and return success status"""
    print(f"\n{'='*60}")
    print(f"Running: {test_name}")
    print(f"{'='*60}")

    try:
        result = subprocess.run(
            [sys.executable, test_file],
            capture_output=True,
            text=True,
            cwd=Path(__file__).parent,
        )

        print(result.stdout)
        if result.stderr:
            print("Errors:", result.stderr)

        return result.returncode == 0
    except Exception as e:
        print(f"Failed to run {test_name}: {e}")
        return False


def main():
    """Run all test suites"""
    print("\n" + "=" * 60)
    print("NETWORKIQ COMPLETE TEST SUITE")
    print(f"Started: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 60)

    # Check for Gemini API key
    from dotenv import load_dotenv

    load_dotenv()

    if not os.getenv("GEMINI_API_KEY"):
        print("\n❌ ERROR: GEMINI_API_KEY not found in environment")
        print("Please set your API key in the .env file")
        return 1

    # Define test suites
    test_suites = [
        ("pipeline/test_real_profiles.py", "Real LinkedIn Profile Tests"),
        ("test_api.py", "API Endpoint Tests"),
    ]

    # Track results
    results = []
    total_tests = len(test_suites)
    passed_tests = 0

    # Run each test suite
    for test_file, test_name in test_suites:
        test_path = Path(__file__).parent / test_file
        if test_path.exists():
            success = run_test_suite(str(test_path), test_name)
            results.append((test_name, success))
            if success:
                passed_tests += 1
        else:
            print(f"\n⚠️  Skipping {test_name} - file not found: {test_path}")
            results.append((test_name, None))

    # Print summary
    print("\n" + "=" * 60)
    print("TEST SUMMARY")
    print("=" * 60)

    for test_name, success in results:
        if success is None:
            status = "⚠️  SKIPPED"
        elif success:
            status = "✅ PASSED"
        else:
            status = "❌ FAILED"
        print(f"{status}: {test_name}")

    print(f"\nTotal: {passed_tests}/{total_tests} test suites passed")
    print(f"Completed: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")

    # Return exit code
    return 0 if passed_tests == total_tests else 1


if __name__ == "__main__":
    sys.exit(main())
