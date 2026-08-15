#!/bin/bash
# 皮老板聊天机器人 - 一键启动脚本（macOS）

set -e

PROJECT_ROOT="$(cd "$(dirname "$0")" && pwd)"

echo "=========================================="
echo "  🤪 皮老板聊天机器人 启动中..."
echo "=========================================="

# ---- 后端 ----
echo ""
echo "[1/2] 检查并启动后端 FastAPI (端口 8000)..."

cd "$PROJECT_ROOT/backend"

if [ ! -d "venv" ]; then
  echo "  → 首次运行，创建 Python 虚拟环境（使用 Python 3.12，兼容性更好）..."
  uv venv venv --python 3.12
fi

source venv/bin/activate
uv pip install -q -r requirements.txt

if [ ! -f ".env" ]; then
  echo "  ⚠️  警告：backend/.env 不存在！请先复制 .env.example 并填入 API_KEY"
fi

# 杀掉占用 8000 端口的旧进程
lsof -ti:8000 | xargs kill -9 2>/dev/null || true

uvicorn main:app --host 0.0.0.0 --port 8000 --reload > /tmp/piboss_backend.log 2>&1 &
BACKEND_PID=$!
echo "  ✅ 后端已启动 PID=$BACKEND_PID  日志：/tmp/piboss_backend.log"
sleep 2

# ---- 前端 ----
echo ""
echo "[2/2] 检查并启动前端 React (端口 5173)..."
cd "$PROJECT_ROOT/frontend"

if [ ! -d "node_modules" ]; then
  echo "  → 首次运行，安装 npm 依赖..."
  npm install
fi

# 杀掉占用 5173 端口的旧进程
lsof -ti:5173 | xargs kill -9 2>/dev/null || true

npm run dev > /tmp/piboss_frontend.log 2>&1 &
FRONTEND_PID=$!
echo "  ✅ 前端已启动 PID=$FRONTEND_PID  日志：/tmp/piboss_frontend.log"
sleep 3

echo ""
echo "=========================================="
echo "  🎉 皮老板已经上线啦！"
echo "  👉 浏览器打开：http://localhost:5173"
echo ""
echo "  停止运行请按：Ctrl+C"
echo "=========================================="

# 前后台管理
cleanup() {
  echo ""
  echo "🛑 正在关闭皮老板..."
  kill $BACKEND_PID 2>/dev/null || true
  kill $FRONTEND_PID 2>/dev/null || true
  lsof -ti:8000 | xargs kill -9 2>/dev/null || true
  lsof -ti:5173 | xargs kill -9 2>/dev/null || true
  echo "✅ 已关闭，下次再见～"
  exit 0
}

trap cleanup INT TERM
wait
