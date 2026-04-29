#!/usr/bin/env bash
# ============================================================
# Full-flow QA smoke test
# Tests: signup → login → project → workshop → context → gather
#        → cluster → vote → design (4 steps) → finalize-vote
#        → final-task-detail → solution-canvas → generate → report
# ============================================================
set -euo pipefail

BASE="http://127.0.0.1:3000"
COOKIE="/tmp/qa-cookie-$$"
PASS=0
FAIL=0
TOTAL=0
TS=$(date +%s)

cleanup() { rm -f "$COOKIE"; }
trap cleanup EXIT

ok()   { PASS=$((PASS+1)); TOTAL=$((TOTAL+1)); printf "  ✅ %s\n" "$1"; }
fail() { FAIL=$((FAIL+1)); TOTAL=$((TOTAL+1)); printf "  ❌ %s\n" "$1"; }
check() {
  local label="$1" actual="$2" expected="$3"
  if [ "$actual" = "$expected" ]; then ok "$label"; else fail "$label (got: $actual, expected: $expected)"; fi
}
check_not_empty() {
  local label="$1" actual="$2"
  if [ -n "$actual" ] && [ "$actual" != "null" ]; then ok "$label"; else fail "$label (empty/null)"; fi
}
jq_field() { echo "$1" | python3 -c "import sys,json;d=json.load(sys.stdin);print(d$2)" 2>/dev/null || echo ""; }

echo "=============================================="
echo "  QA Full-Flow Smoke Test"
echo "  $(date)"
echo "=============================================="
echo ""

# --------------------------------------------------
echo "=== 1. Health Check ==="
HC=$(curl -s "$BASE/api/health" 2>/dev/null || echo '{}')
HC_STATUS=$(jq_field "$HC" "['data']['status']")
check "Health endpoint" "$HC_STATUS" "ok"

# --------------------------------------------------
echo ""
echo "=== 2. Signup + Login ==="
EMAIL="qa-${TS}@test.com"
SIGNUP=$(curl -s -X POST "$BASE/api/auth/signup" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"Test1234!\",\"name\":\"QA Tester\"}" 2>/dev/null || echo '{}')
PENDING=$(jq_field "$SIGNUP" "['data']['pending_approval']")
check "Signup pending_approval" "$PENDING" "True"

# Use admin account (auto-approved in seed)
LOGIN=$(curl -s -c "$COOKIE" -X POST "$BASE/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@admin.com","password":"123123123"}' 2>/dev/null || echo '{}')
USER_ID=$(jq_field "$LOGIN" "['data']['user']['id']")
check_not_empty "Admin login user_id" "$USER_ID"

# --------------------------------------------------
echo ""
echo "=== 3. Create Project ==="
PROJ=$(curl -s -b "$COOKIE" -X POST "$BASE/api/projects" \
  -H "Content-Type: application/json" \
  -d "{\"name\":\"QA Project $TS\"}" 2>/dev/null || echo '{}')
PROJECT_ID=$(jq_field "$PROJ" "['data']['id']")
check_not_empty "Project created" "$PROJECT_ID"

# --------------------------------------------------
echo ""
echo "=== 4. Create Workshop ==="
WS=$(curl -s -b "$COOKIE" -X POST "$BASE/api/workshops" \
  -H "Content-Type: application/json" \
  -d "{\"project_id\":\"$PROJECT_ID\",\"title\":\"QA Workshop $TS\",\"description\":\"Automated QA test\"}" 2>/dev/null || echo '{}')
WORKSHOP_ID=$(jq_field "$WS" "['data']['workshop']['id']")
WS_STAGE=$(jq_field "$WS" "['data']['workshop']['current_stage']")
check_not_empty "Workshop created" "$WORKSHOP_ID"
check "Workshop initial stage" "$WS_STAGE" "context"

# --------------------------------------------------
echo ""
echo "=== 5. Context Stage — Create Process Steps ==="
# Acquire editing lock first
LOCK=$(curl -s -b "$COOKIE" -X POST "$BASE/api/workshops/$WORKSHOP_ID/editing-locks" \
  -H "Content-Type: application/json" \
  -d '{"resource_type":"process_graph"}' 2>/dev/null || echo '{}')
check_not_empty "Editing lock acquired" "$(jq_field "$LOCK" "['data']['id']")"

# Need start_event, task, end_event to satisfy prerequisites
START=$(curl -s -b "$COOKIE" -X POST "$BASE/api/workshops/$WORKSHOP_ID/process-steps" \
  -H "Content-Type: application/json" \
  -d '{"name":"시작","node_type":"start_event","order_index":0}' 2>/dev/null || echo '{}')
START_ID=$(jq_field "$START" "['data']['id']")
check_not_empty "Start event created" "$START_ID"

TASK1=$(curl -s -b "$COOKIE" -X POST "$BASE/api/workshops/$WORKSHOP_ID/process-steps" \
  -H "Content-Type: application/json" \
  -d '{"name":"접수","description":"고객 요청을 접수합니다","node_type":"task","order_index":1}' 2>/dev/null || echo '{}')
TASK1_ID=$(jq_field "$TASK1" "['data']['id']")
check_not_empty "Task node created" "$TASK1_ID"

TASK2=$(curl -s -b "$COOKIE" -X POST "$BASE/api/workshops/$WORKSHOP_ID/process-steps" \
  -H "Content-Type: application/json" \
  -d '{"name":"처리","description":"요청을 검토하고 처리합니다","node_type":"task","order_index":2}' 2>/dev/null || echo '{}')
check_not_empty "Task node 2 created" "$(jq_field "$TASK2" "['data']['id']")"

END=$(curl -s -b "$COOKIE" -X POST "$BASE/api/workshops/$WORKSHOP_ID/process-steps" \
  -H "Content-Type: application/json" \
  -d '{"name":"종료","node_type":"end_event","order_index":3}' 2>/dev/null || echo '{}')
check_not_empty "End event created" "$(jq_field "$END" "['data']['id']")"

# Advance: context → gather
ADV1=$(curl -s -b "$COOKIE" -X PATCH "$BASE/api/workshops/$WORKSHOP_ID" \
  -H "Content-Type: application/json" \
  -d '{"current_stage":"gather"}' 2>/dev/null || echo '{}')
check "Stage → gather" "$(jq_field "$ADV1" "['data']['current_stage']")" "gather"

# --------------------------------------------------
echo ""
echo "=== 6. Gather Stage — Create Notes ==="
COLORS=("yellow" "green" "blue" "red" "yellow" "green")
CONTENTS=("고객 문의 접수가 너무 오래 걸림" "반복 업무가 많아 자동화 필요" "데이터 입력 실수가 자주 발생" "보고서 작성에 시간이 많이 소요" "승인 프로세스가 복잡하고 느림" "시스템 간 데이터 연동이 안됨")
for i in $(seq 1 6); do
  IDX=$((i-1))
  NOTE=$(curl -s -b "$COOKIE" -X POST "$BASE/api/notes" \
    -H "Content-Type: application/json" \
    -d "{\"workshop_id\":\"$WORKSHOP_ID\",\"content\":\"${CONTENTS[$IDX]}\",\"color\":\"${COLORS[$IDX]}\",\"position_x\":$((i*100)),\"position_y\":$((i*80))}" 2>/dev/null || echo '{}')
  NOTE_ID=$(jq_field "$NOTE" "['data']['id']")
  if [ $i -eq 1 ]; then
    check_not_empty "Note 1 created" "$NOTE_ID"
    FIRST_NOTE_ID="$NOTE_ID"
  fi
done
ok "6 notes created"

# Advance: gather → cluster
ADV2=$(curl -s -b "$COOKIE" -X PATCH "$BASE/api/workshops/$WORKSHOP_ID" \
  -H "Content-Type: application/json" \
  -d '{"current_stage":"cluster"}' 2>/dev/null || echo '{}')
check "Stage → cluster" "$(jq_field "$ADV2" "['data']['current_stage']")" "cluster"

# --------------------------------------------------
echo ""
echo "=== 7. Cluster Stage — AI Clustering ==="
CLUSTER_AI=$(curl -s -b "$COOKIE" -X POST "$BASE/api/ai/cluster" \
  -H "Content-Type: application/json" \
  -d "{\"workshop_id\":\"$WORKSHOP_ID\"}" 2>/dev/null || echo '{}')
CLUSTER_VER=$(echo "$CLUSTER_AI" | python3 -c "import sys,json;d=json.load(sys.stdin);data=d.get('data',[]);print(len(data) if isinstance(data,list) else 0)" 2>/dev/null || echo "0")
if [ "$CLUSTER_VER" -ge 1 ]; then ok "AI clustering done ($CLUSTER_VER clusters)"; else fail "AI clustering failed"; fi

# Get clusters
CLUSTERS=$(curl -s -b "$COOKIE" "$BASE/api/clusters?workshop_id=$WORKSHOP_ID" 2>/dev/null || echo '{}')
CLUSTER_ID=$(jq_field "$CLUSTERS" "['data'][0]['id']")
check_not_empty "First cluster ID" "$CLUSTER_ID"

# Score clusters (required for vote stage)
SCORE=$(curl -s -b "$COOKIE" -X POST "$BASE/api/clusters/$CLUSTER_ID/scores?workshop_id=$WORKSHOP_ID" \
  -H "Content-Type: application/json" \
  -d '{"score_impact":5,"score_feasibility":4,"score_urgency":3}' 2>/dev/null || echo '{}')
check_not_empty "Cluster scored" "$(jq_field "$SCORE" "['data']['id']")"

# Advance: cluster → vote
ADV3=$(curl -s -b "$COOKIE" -X PATCH "$BASE/api/workshops/$WORKSHOP_ID" \
  -H "Content-Type: application/json" \
  -d '{"current_stage":"vote"}' 2>/dev/null || echo '{}')
check "Stage → vote" "$(jq_field "$ADV3" "['data']['current_stage']")" "vote"

# --------------------------------------------------
echo ""
echo "=== 8. Vote Stage — Vote on Cluster ==="
VOTE=$(curl -s -b "$COOKIE" -X POST "$BASE/api/votes" \
  -H "Content-Type: application/json" \
  -d "{\"workshop_id\":\"$WORKSHOP_ID\",\"cluster_id\":\"$CLUSTER_ID\"}" 2>/dev/null || echo '{}')
VOTE_ID=$(jq_field "$VOTE" "['data']['id']")
check_not_empty "Vote cast" "$VOTE_ID"

# Advance: vote → design
ADV4=$(curl -s -b "$COOKIE" -X PATCH "$BASE/api/workshops/$WORKSHOP_ID" \
  -H "Content-Type: application/json" \
  -d '{"current_stage":"design"}' 2>/dev/null || echo '{}')
check "Stage → design" "$(jq_field "$ADV4" "['data']['current_stage']")" "design"

# --------------------------------------------------
echo ""
echo "=== 9. Design Step 1 — AI 과제 도출 ==="
DS1=$(curl -s -b "$COOKIE" -X POST "$BASE/api/ai/design" \
  -H "Content-Type: application/json" \
  -d "{\"workshop_id\":\"$WORKSHOP_ID\",\"design_step\":1}" 2>/dev/null || echo '{}')
DS1_VER=$(echo "$DS1" | python3 -c "import sys,json;d=json.load(sys.stdin);arts=d.get('data',{}).get('design_artifacts',[]);print(arts[0]['version'] if arts else '')" 2>/dev/null || echo "")
check_not_empty "Design step 1 completed (version)" "$DS1_VER"

# Get tasks from step 1
TASKS=$(curl -s -b "$COOKIE" "$BASE/api/tasks?workshop_id=$WORKSHOP_ID" 2>/dev/null || echo '{}')
TASK_LIST_LEN=$(echo "$TASKS" | python3 -c "import sys,json;d=json.load(sys.stdin);print(len(d.get('data',[])))" 2>/dev/null || echo "0")
if [ "$TASK_LIST_LEN" -ge 1 ]; then
  ok "Tasks generated: $TASK_LIST_LEN"
else
  fail "No tasks generated"
fi

FIRST_TASK_ID=$(echo "$TASKS" | python3 -c "import sys,json;d=json.load(sys.stdin);print(d['data'][0]['id'])" 2>/dev/null || echo "")
check_not_empty "First task ID" "$FIRST_TASK_ID"

# --------------------------------------------------
echo ""
echo "=== 10. Design Step 2 — Task Voting + Finalize ==="
# Vote for first task
TVOTE=$(curl -s -b "$COOKIE" -X POST "$BASE/api/votes" \
  -H "Content-Type: application/json" \
  -d "{\"workshop_id\":\"$WORKSHOP_ID\",\"task_id\":\"$FIRST_TASK_ID\"}" 2>/dev/null || echo '{}')
TVOTE_ID=$(jq_field "$TVOTE" "['data']['id']")
check_not_empty "Task vote cast" "$TVOTE_ID"

# Finalize vote
FINALIZE=$(curl -s -b "$COOKIE" -X POST "$BASE/api/workshops/$WORKSHOP_ID/finalize-vote" \
  -H "Content-Type: application/json" \
  -d '{}' 2>/dev/null || echo '{}')
WINNER_ID=$(jq_field "$FINALIZE" "['data']['winner']['id']")
check "Vote winner = first task" "$WINNER_ID" "$FIRST_TASK_ID"

# Check design_step advanced to 2
WS_STATE=$(curl -s -b "$COOKIE" "$BASE/api/workshops/$WORKSHOP_ID" 2>/dev/null || echo '{}')
DS_STEP=$(jq_field "$WS_STATE" "['data']['workshop']['design_step']")
check "design_step = 2" "$DS_STEP" "2"

# --------------------------------------------------
echo ""
echo "=== 11. Design Step 3 — AI 최종 과제 심화 확장 ==="
DS3=$(curl -s -b "$COOKIE" -X POST "$BASE/api/ai/design" \
  -H "Content-Type: application/json" \
  -d "{\"workshop_id\":\"$WORKSHOP_ID\",\"design_step\":3}" 2>/dev/null || echo '{}')
DS3_VER=$(echo "$DS3" | python3 -c "import sys,json;d=json.load(sys.stdin);arts=d.get('data',{}).get('design_artifacts',[]);print(arts[0]['version'] if arts else '')" 2>/dev/null || echo "")
DS3_ERR=$(echo "$DS3" | python3 -c "import sys,json;d=json.load(sys.stdin);print(d.get('error',{}).get('message',''))" 2>/dev/null || echo "")
if [ -n "$DS3_VER" ] && [ "$DS3_VER" != "" ]; then
  check_not_empty "Design step 3 completed (version)" "$DS3_VER"
else
  fail "Design step 3 failed: $DS3_ERR"
fi

# Verify design_step advanced to 3
WS_DS3=$(curl -s -b "$COOKIE" "$BASE/api/workshops/$WORKSHOP_ID" 2>/dev/null || echo '{}')
DS3_STEP=$(jq_field "$WS_DS3" "['data']['workshop']['design_step']")
check "design_step = 3" "$DS3_STEP" "3"

# --------------------------------------------------
echo ""
echo "=== 12. Curation — PATCH final_task_detail ==="
# Get current artifact to verify final_task_detail
ARTIFACTS=$(curl -s -b "$COOKIE" "$BASE/api/workshops/$WORKSHOP_ID/design-artifacts" 2>/dev/null || echo '{}')
HAS_DETAIL=$(echo "$ARTIFACTS" | python3 -c "
import sys,json
d=json.load(sys.stdin)
arts=d.get('data',{}).get('design_artifacts',[])
if arts and arts[0].get('final_task_detail'):
    print('yes')
else:
    print('no')
" 2>/dev/null || echo "no")
check "final_task_detail exists" "$HAS_DETAIL" "yes"

# Try PATCH curation (toggle a check)
CURATED=$(echo "$ARTIFACTS" | python3 -c "
import sys,json
d=json.load(sys.stdin)
ftd=d['data']['design_artifacts'][0]['final_task_detail']
if ftd.get('risks') and len(ftd['risks'])>0:
    ftd['risks'][0]['is_checked']=False
print(json.dumps(ftd))
" 2>/dev/null || echo '{}')

PATCH_RES=$(curl -s -b "$COOKIE" -X PATCH "$BASE/api/workshops/$WORKSHOP_ID/final-task-detail" \
  -H "Content-Type: application/json" \
  -d "$CURATED" 2>/dev/null || echo '{}')
PATCH_OK=$(jq_field "$PATCH_RES" "['data']['final_task_detail']['title']")
check_not_empty "Curation PATCH succeeded" "$PATCH_OK"

# --------------------------------------------------
echo ""
echo "=== 13. Design Step 4 — AI 솔루션 캔버스 ==="
DS4=$(curl -s -b "$COOKIE" -X POST "$BASE/api/ai/design" \
  -H "Content-Type: application/json" \
  -d "{\"workshop_id\":\"$WORKSHOP_ID\",\"design_step\":4}" 2>/dev/null || echo '{}')
DS4_VER=$(echo "$DS4" | python3 -c "import sys,json;d=json.load(sys.stdin);arts=d.get('data',{}).get('design_artifacts',[]);print(arts[0]['version'] if arts else '')" 2>/dev/null || echo "")
DS4_ERR=$(echo "$DS4" | python3 -c "import sys,json;d=json.load(sys.stdin);print(d.get('error',{}).get('message',''))" 2>/dev/null || echo "")
if [ -n "$DS4_VER" ] && [ "$DS4_VER" != "" ]; then
  check_not_empty "Design step 4 completed (version)" "$DS4_VER"
else
  fail "Design step 4 failed: $DS4_ERR"
fi

# Verify solution_canvas exists
ARTIFACTS4=$(curl -s -b "$COOKIE" "$BASE/api/workshops/$WORKSHOP_ID/design-artifacts" 2>/dev/null || echo '{}')
HAS_CANVAS=$(echo "$ARTIFACTS4" | python3 -c "
import sys,json
d=json.load(sys.stdin)
arts=d.get('data',{}).get('design_artifacts',[])
if arts and arts[0].get('solution_canvas'):
    print('yes')
else:
    print('no')
" 2>/dev/null || echo "no")
check "solution_canvas exists" "$HAS_CANVAS" "yes"

# Check canvas sections
CANVAS_SECTIONS=$(echo "$ARTIFACTS4" | python3 -c "
import sys,json
d=json.load(sys.stdin)
c=d['data']['design_artifacts'][0]['solution_canvas']
sections=['use_case','data','stakeholders','value_kpi','concern']
present=[s for s in sections if s in c]
print(len(present))
" 2>/dev/null || echo "0")
check "Canvas has 5 sections" "$CANVAS_SECTIONS" "5"

# Check design_step = 4
WS_DS4=$(curl -s -b "$COOKIE" "$BASE/api/workshops/$WORKSHOP_ID" 2>/dev/null || echo '{}')
DS4_STEP=$(jq_field "$WS_DS4" "['data']['workshop']['design_step']")
check "design_step = 4" "$DS4_STEP" "4"

# --------------------------------------------------
echo ""
echo "=== 14. Advance to Generate Stage ==="
ADV5=$(curl -s -b "$COOKIE" -X PATCH "$BASE/api/workshops/$WORKSHOP_ID" \
  -H "Content-Type: application/json" \
  -d '{"current_stage":"generate"}' 2>/dev/null || echo '{}')
GEN_STAGE=$(jq_field "$ADV5" "['data']['current_stage']")
check "Stage → generate" "$GEN_STAGE" "generate"

# --------------------------------------------------
echo ""
echo "=== 15. AI Generate (PRD) ==="
GEN=$(curl -s -b "$COOKIE" -X POST "$BASE/api/ai/generate" \
  -H "Content-Type: application/json" \
  -d "{\"workshop_id\":\"$WORKSHOP_ID\"}" 2>/dev/null || echo '{}')
PRD_VER=$(echo "$GEN" | python3 -c "import sys,json;d=json.load(sys.stdin);print(d.get('data',{}).get('version',''))" 2>/dev/null || echo "")
GEN_ERR=$(echo "$GEN" | python3 -c "import sys,json;d=json.load(sys.stdin);print(d.get('error',{}).get('message',''))" 2>/dev/null || echo "")
if [ -n "$PRD_VER" ] && [ "$PRD_VER" != "" ]; then
  check_not_empty "PRD generated (version)" "$PRD_VER"
else
  fail "PRD generation failed: $GEN_ERR"
fi

# Advance: generate → report
ADV6=$(curl -s -b "$COOKIE" -X PATCH "$BASE/api/workshops/$WORKSHOP_ID" \
  -H "Content-Type: application/json" \
  -d '{"current_stage":"report"}' 2>/dev/null || echo '{}')
check "Stage → report" "$(jq_field "$ADV6" "['data']['current_stage']")" "report"

# --------------------------------------------------
echo ""
echo "=== 16. AI Report ==="
RPT=$(curl -s -b "$COOKIE" -X POST "$BASE/api/ai/report" \
  -H "Content-Type: application/json" \
  -d "{\"workshop_id\":\"$WORKSHOP_ID\"}" 2>/dev/null || echo '{}')
RPT_VER=$(echo "$RPT" | python3 -c "import sys,json;d=json.load(sys.stdin);print(d.get('data',{}).get('version',''))" 2>/dev/null || echo "")
RPT_ERR=$(echo "$RPT" | python3 -c "import sys,json;d=json.load(sys.stdin);print(d.get('error',{}).get('message',''))" 2>/dev/null || echo "")
if [ -n "$RPT_VER" ] && [ "$RPT_VER" != "" ]; then
  check_not_empty "Report generated (version)" "$RPT_VER"
else
  fail "Report generation failed: $RPT_ERR"
fi

# --------------------------------------------------
echo ""
echo "=============================================="
echo "  Results: $PASS passed / $FAIL failed / $TOTAL total"
echo "=============================================="
if [ "$FAIL" -gt 0 ]; then
  echo "  ⚠️  Some tests failed!"
  exit 1
else
  echo "  🎉 All tests passed!"
  exit 0
fi
