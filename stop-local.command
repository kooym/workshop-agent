#!/bin/zsh
# ──────────────────────────────────────────────────
#  Workshop Agent — 종료 (Finder 더블클릭 전용)
# ──────────────────────────────────────────────────

export PATH="/opt/homebrew/bin:/opt/homebrew/sbin:/usr/local/bin:$PATH"
SCRIPT_DIR="${0:A:h}"
cd "$SCRIPT_DIR" || exit 1

echo ""
echo "═══════════════════════════════════════"
echo "  Workshop Agent — 종료"
echo "═══════════════════════════════════════"
echo ""

# ─── 1. Next.js dev server 종료 ───
PIDS=$(lsof -ti:3000 -ti:3001 -ti:3002 2>/dev/null || true)
if [[ -n "$PIDS" ]]; then
  echo "$PIDS" | xargs kill -9 2>/dev/null || true
  echo "✓ Next.js dev server 종료됨"
else
  echo "  Next.js dev server가 실행 중이 아닙니다"
fi

# ─── 2. Supabase 종료 ───
if docker ps --format '{{.Names}}' 2>/dev/null | grep -q 'supabase_db_workshop-agent'; then
  echo "🗄  Supabase 종료 중..."
  npx supabase stop
  echo "✓ Supabase 종료됨"
else
  echo "  Supabase가 실행 중이 아닙니다"
fi

echo ""
echo "  모든 서비스가 종료되었습니다."
echo ""
echo "  아무 키나 누르면 창을 닫습니다..."
read -k 1 -s
