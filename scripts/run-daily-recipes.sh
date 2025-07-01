#!/bin/bash

# Daily AI Recipe Generation Script
# This script generates 100 new AI recipes daily

# Set the working directory to the project root
cd "$(dirname "$0")/.."

# Create logs directory if it doesn't exist
mkdir -p logs

# Get current date for logging
DATE=$(date +"%Y-%m-%d")
TIMESTAMP=$(date +"%Y-%m-%d %H:%M:%S")

echo "[$TIMESTAMP] Starting daily AI recipe generation..." >> logs/daily-recipes.log

# Run the daily recipe generation script
npx ts-node scripts/daily-ai-recipes.ts >> logs/daily-recipes.log 2>&1

# Check if the script ran successfully
if [ $? -eq 0 ]; then
    echo "[$TIMESTAMP] Daily AI recipe generation completed successfully!" >> logs/daily-recipes.log
else
    echo "[$TIMESTAMP] Daily AI recipe generation failed!" >> logs/daily-recipes.log
    exit 1
fi 