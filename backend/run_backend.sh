#!/bin/bash
# Script to run the backend with the correct virtual environment

echo "Starting NetworkIQ backend with virtual environment..."
cd "$(dirname "$0")"
../venv/bin/python main.py