#!/bin/bash

# CollabBoard Start Script

echo "🚀 Starting CollabBoard Setup..."

# 1. Check for node_modules
if [ ! -d "node_modules" ]; then
    echo "📦 node_modules not found. Installing dependencies..."
    npm install
else
    echo "✅ Dependencies already installed."
fi

# 2. Check for .env file
if [ ! -f ".env" ]; then
    echo "⚠️  WARNING: .env file not found!"
    echo "Please create a .env file in the root directory and add your Firebase credentials."
    echo "You can use .env.example as a template:"
    echo "cp .env.example .env"
    echo ""
    # We don't exit here because they might have the env vars set elsewhere or want to see the app fail gracefully
else
    echo "✅ .env file detected."
fi

# 3. Start the development server
echo "Starting Vite development server..."
npm run dev
