#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────
# 기존 Supabase CLI 컨테이너/이미지/볼륨/네트워크 완전 제거
# docker compose로 통합 전 실행
# ──────────────────────────────────────────────────────────
set -euo pipefail

echo "=== 1. Supabase CLI 중지 ==="
npx supabase stop --no-backup 2>/dev/null || echo "  (이미 중지됨)"

echo ""
echo "=== 2. supabase_ 접두사 컨테이너 제거 ==="
CONTAINERS=$(docker ps -a --filter "name=supabase_" --format "{{.Names}}" 2>/dev/null || true)
if [ -n "$CONTAINERS" ]; then
  echo "$CONTAINERS" | xargs docker rm -f
  echo "  제거 완료"
else
  echo "  (제거할 컨테이너 없음)"
fi

echo ""
echo "=== 3. supabase_ 접두사 볼륨 제거 ==="
VOLUMES=$(docker volume ls --filter "name=supabase_" --format "{{.Name}}" 2>/dev/null || true)
if [ -n "$VOLUMES" ]; then
  echo "$VOLUMES" | xargs docker volume rm -f
  echo "  제거 완료"
else
  echo "  (제거할 볼륨 없음)"
fi

echo ""
echo "=== 4. supabase_ 접두사 네트워크 제거 ==="
NETWORKS=$(docker network ls --filter "name=supabase_" --format "{{.Name}}" 2>/dev/null || true)
if [ -n "$NETWORKS" ]; then
  echo "$NETWORKS" | xargs docker network rm 2>/dev/null || true
  echo "  제거 완료"
else
  echo "  (제거할 네트워크 없음)"
fi

echo ""
echo "=== 5. 사용하지 않는 Docker 리소스 정리 ==="
docker system prune -f --volumes 2>/dev/null || true

echo ""
echo "=== 정리 완료 ==="
echo "이제 'docker compose up -d' 로 새 환경을 시작할 수 있습니다."
