#!/bin/zsh
# ──────────────────────────────────────────────────
#  Workshop Agent — 로컬 실행 (Finder 더블클릭 전용)
# ──────────────────────────────────────────────────

# Homebrew PATH (macOS Terminal.app에서 누락되는 경우 대비)
export PATH="/opt/homebrew/bin:/opt/homebrew/sbin:/usr/local/bin:$PATH"

# 프로젝트 디렉토리로 이동 (공백 경로 안전 처리)
SCRIPT_DIR="${0:A:h}"
cd "$SCRIPT_DIR" || exit 1

# 에러 시 안내 메시지 출력 후 대기
bail() {
  echo ""
  echo "   아무 키나 누르면 종료합니다..."
  read -k 1 -s
  exit 1
}

echo ""
echo "═══════════════════════════════════════"
echo "  Workshop Agent — 로컬 실행"
echo "═══════════════════════════════════════"
echo ""

# ─── 0. Node.js 폴더 접근 권한 확인 ───
#  macOS의 TCC(투명성·동의·제어) 정책으로 인해
#  Terminal.app이 ~/Documents 폴더에 접근하지 못하면
#  Node.js가 EPERM 에러를 발생시킵니다.
if ! node -e "process.cwd()" 2>/dev/null; then
  echo "❌ Terminal.app이 이 폴더(Documents)에 접근할 수 없습니다."
  echo ""
  echo "   지금 시스템 설정을 자동으로 엽니다."
  echo "   '전체 디스크 접근 권한' 목록에서 '터미널'을 찾아 켜주세요."
  echo "   (목록에 없으면 + 버튼으로 추가)"
  echo ""
  open "x-apple.systempreferences:com.apple.preference.security?Privacy_AllFiles"
  echo "   설정 변경 후 이 파일을 다시 더블클릭하세요."
  bail
fi

# ─── 1. Docker Desktop 확인 ───
if ! docker info >/dev/null 2>&1; then
  echo "❌ Docker Desktop이 실행되고 있지 않습니다."
  echo "   Docker Desktop을 먼저 실행한 후 이 파일을 다시 더블클릭하세요."
  bail
fi
echo "✓ Docker Desktop 실행 중"

# ─── 2. 환경 변수 ───
if [[ ! -f ".env" ]]; then
  if [[ -f ".env.example" ]]; then
    cp ".env.example" ".env"
    echo "⚠ .env 생성됨 — Supabase / Azure OpenAI 값을 입력한 후 다시 실행하세요."
  else
    echo "❌ .env.example 파일이 없습니다."
  fi
  bail
fi
echo "✓ .env 설정 파일 확인"

# ─── 3. Docker Compose 스택 시작 ───
if ! docker compose ps --status running 2>/dev/null | grep -q 'db'; then
  echo "🗄  Docker Compose 스택 시작 중 (1~2분 소요)..."
  docker compose up -d --wait --wait-timeout 120
else
  echo "✓ Docker Compose 스택 이미 실행 중"
fi

# ─── 5. 포트 확인 ───
PORT="${PORT:-3000}"
echo ""
echo "═══════════════════════════════════════"
echo "  앱:              http://localhost:${PORT}"
echo "  Supabase Studio: http://127.0.0.1:54323"
echo "  Supabase API:    http://127.0.0.1:54321"
echo "  DB:              http://127.0.0.1:54322"
echo "═══════════════════════════════════════"
echo ""
echo "  종료: docker compose down"
echo ""

open "http://localhost:${PORT}"
