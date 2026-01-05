#!/bin/bash
# Seismic Trading Bot - Complete Startup Script
# This script starts all services: blockchain, backend API, and frontend

set -e

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$PROJECT_ROOT/backend"
FRONTEND_DIR="$PROJECT_ROOT/frontend"

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${BLUE}================================================${NC}"
echo -e "${BLUE}🚀 Seismic AI Trading Bot - Starting All Services${NC}"
echo -e "${BLUE}================================================${NC}\n"

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo -e "${YELLOW} Node.js is not installed. Please install Node.js first.${NC}"
    exit 1
fi

echo -e "${GREEN} Node.js found: $(node --version)${NC}\n"

# Check if ports are available
check_port() {
    if lsof -Pi :$1 -sTCP:LISTEN -t >/dev/null 2>&1 ; then
        return 0
    else
        return 1
    fi
}

echo -e "${BLUE}📋 Checking ports...${NC}"
BACKEND_PORT=${BACKEND_PORT:-3001}
FRONTEND_PORT=${FRONTEND_PORT:-3000}

if check_port $BACKEND_PORT; then
    echo -e "${YELLOW}  Port $BACKEND_PORT is already in use${NC}"
fi

if check_port $FRONTEND_PORT; then
    echo -e "${YELLOW}  Port $FRONTEND_PORT is already in use${NC}"
fi

echo -e "\n${BLUE}📦 Installing dependencies...${NC}"
cd "$PROJECT_ROOT"
npm install --legacy-peer-deps > /dev/null 2>&1 || true

echo -e "${GREENz Dependencies installed${NC}\n"

# Start Backend
echo -e "${BLUE}🔗 Starting Backend API Server (Port $BACKEND_PORT)...${NC}"
cd "$BACKEND_DIR"
node server.js &
BACKEND_PID=$!
sleep 3
echo -e "${GREEN} Backend started (PID: $BACKEND_PID)${NC}"

# Start Frontend
echo -e "\n${BLUE}🎨 Starting Frontend (Port $FRONTEND_PORT)...${NC}"
cd "$FRONTEND_DIR"
npm run dev > /dev/null 2>&1 &
FRONTEND_PID=$!
sleep 5
echo -e "${GREEN}✅ Frontend started (PID: $FRONTEND_PID)${NC}"

echo -e "\n${BLUE}================================================${NC}"
echo -e "${GREEN}🎉 All Services Started Successfully!${NC}"
echo -e "${BLUE}================================================${NC}\n"

echo -e "${YELLOW}📍 Service URLs:${NC}"
echo -e "  🎨 Frontend:      http://localhost:$FRONTEND_PORT"
echo -e "  🔗 Backend API:   http://localhost:$BACKEND_PORT"
echo -e "  💚 Health Check:  http://localhost:$BACKEND_PORT/api/health\n"

echo -e "${YELLOW}📝 Available Endpoints:${NC}"
echo -e "  GET  /api/coins               - List supported coins"
echo -e "  GET  /api/market/:coinId      - Market data + analysis"
echo -e "  GET  /api/blockchain/balance  - User balance"
echo -e "  GET  /api/blockchain/trades   - Trade history"
echo -e "  POST /api/blockchain/trade    - Execute trade"
echo -e "  POST /api/bot/start           - Start auto-trading"
echo -e "  POST /api/bot/stop            - Stop auto-trading\n"

echo -e "${YELLOW}🛑 To stop services, press Ctrl+C or run:${NC}"
echo -e "  kill $BACKEND_PID $FRONTEND_PID\n"

# Handle graceful shutdown
cleanup() {
    echo -e "\n${YELLOW}🛑 Shutting down services...${NC}"
    kill $BACKEND_PID 2>/dev/null || true
    kill $FRONTEND_PID 2>/dev/null || true
    wait $BACKEND_PID 2>/dev/null || true
    wait $FRONTEND_PID 2>/dev/null || true
    echo -e "${GREEN}✅ All services stopped${NC}"
    exit 0
}

trap cleanup SIGINT SIGTERM

# Keep script running
wait
