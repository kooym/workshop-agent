"""
execute.py 리팩터링 안전망 테스트.
리팩터링 전후 동작이 동일한지 검증한다.
"""

import json
import os
import subprocess
import sys
import textwrap
from datetime import datetime, timezone, timedelta
from pathlib import Path
from unittest.mock import patch, MagicMock

import pytest

sys.path.insert(0, str(Path(__file__).parent))
import execute as ex


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture
def tmp_project(tmp_path):
    """phases/, CLAUDE.md, docs/ 를 갖춘 임시 프로젝트 구조."""
    phases_dir = tmp_path / "phases"
    phases_dir.mkdir()

    claude_md = tmp_path / "CLAUDE.md"
    claude_md.write_text("# Rules\n- rule one\n- rule two")

    docs_dir = tmp_path / "docs"
    docs_dir.mkdir()
    (docs_dir / "arch.md").write_text("# Architecture\nSome content")
    (docs_dir / "guide.md").write_text("# Guide\nAnother doc")

    return tmp_path


@pytest.fixture
def phase_dir(tmp_project):
    """step 3개를 가진 phase 디렉토리."""
    d = tmp_project / "phases" / "0-mvp"
    d.mkdir()

    index = {
        "project": "TestProject",
        "phase": "mvp",
        "steps": [
            {"step": 0, "name": "setup", "status": "completed", "summary": "프로젝트 초기화 완료"},
            {"step": 1, "name": "core", "status": "completed", "summary": "핵심 로직 구현"},
            {"step": 2, "name": "ui", "status": "pending"},
        ],
    }
    (d / "index.json").write_text(json.dumps(index, indent=2, ensure_ascii=False))
    (d / "step2.md").write_text("# Step 2: UI\n\nUI를 구현하세요.")

    return d


@pytest.fixture
def top_index(tmp_project):
    """phases/index.json (top-level)."""
    top = {
        "phases": [
            {"dir": "0-mvp", "status": "pending"},
            {"dir": "1-polish", "status": "pending"},
        ]
    }
    p = tmp_project / "phases" / "index.json"
    p.write_text(json.dumps(top, indent=2))
    return p


@pytest.fixture
def executor(tmp_project, phase_dir):
    """테스트용 StepExecutor 인스턴스. git 호출은 별도 mock 필요."""
    with patch.object(ex, "ROOT", tmp_project):
        inst = ex.StepExecutor("0-mvp")
    # 내부 경로를 tmp_project 기준으로 재설정
    inst._root = str(tmp_project)
    inst._phases_dir = tmp_project / "phases"
    inst._phase_dir = phase_dir
    inst._phase_dir_name = "0-mvp"
    inst._index_file = phase_dir / "index.json"
    inst._top_index_file = tmp_project / "phases" / "index.json"
    return inst


# ---------------------------------------------------------------------------
# _stamp (= 이전 now_iso)
# ---------------------------------------------------------------------------

class TestStamp:
    def test_returns_kst_timestamp(self, executor):
        result = executor._stamp()
        assert "+0900" in result

    def test_format_is_iso(self, executor):
        result = executor._stamp()
        dt = datetime.strptime(result, "%Y-%m-%dT%H:%M:%S%z")
        assert dt.tzinfo is not None

    def test_is_current_time(self, executor):
        before = datetime.now(ex.StepExecutor.TZ).replace(microsecond=0)
        result = executor._stamp()
        after = datetime.now(ex.StepExecutor.TZ).replace(microsecond=0) + timedelta(seconds=1)
        parsed = datetime.strptime(result, "%Y-%m-%dT%H:%M:%S%z")
        assert before <= parsed <= after


# ---------------------------------------------------------------------------
# _read_json / _write_json
# ---------------------------------------------------------------------------

class TestJsonHelpers:
    def test_roundtrip(self, tmp_path):
        data = {"key": "값", "nested": [1, 2, 3]}
        p = tmp_path / "test.json"
        ex.StepExecutor._write_json(p, data)
        loaded = ex.StepExecutor._read_json(p)
        assert loaded == data

    def test_save_ensures_ascii_false(self, tmp_path):
        p = tmp_path / "test.json"
        ex.StepExecutor._write_json(p, {"한글": "테스트"})
        raw = p.read_text()
        assert "한글" in raw
        assert "\\u" not in raw

    def test_save_indented(self, tmp_path):
        p = tmp_path / "test.json"
        ex.StepExecutor._write_json(p, {"a": 1})
        raw = p.read_text()
        assert "\n" in raw

    def test_load_nonexistent_raises(self, tmp_path):
        with pytest.raises(FileNotFoundError):
            ex.StepExecutor._read_json(tmp_path / "nope.json")


# ---------------------------------------------------------------------------
# _load_guardrails
# ---------------------------------------------------------------------------

class TestLoadGuardrails:
    def test_loads_claude_md_and_docs(self, executor, tmp_project):
        with patch.object(ex, "ROOT", tmp_project):
            result = executor._load_guardrails()
        assert "# Rules" in result
        assert "rule one" in result
        assert "# Architecture" in result
        assert "# Guide" in result

    def test_sections_separated_by_divider(self, executor, tmp_project):
        with patch.object(ex, "ROOT", tmp_project):
            result = executor._load_guardrails()
        assert "---" in result

    def test_docs_sorted_alphabetically(self, executor, tmp_project):
        with patch.object(ex, "ROOT", tmp_project):
            result = executor._load_guardrails()
        arch_pos = result.index("arch")
        guide_pos = result.index("guide")
        assert arch_pos < guide_pos

    def test_no_claude_md(self, executor, tmp_project):
        (tmp_project / "CLAUDE.md").unlink()
        with patch.object(ex, "ROOT", tmp_project):
            result = executor._load_guardrails()
        assert "CLAUDE.md" not in result
        assert "Architecture" in result

    def test_no_docs_dir(self, executor, tmp_project):
        import shutil
        shutil.rmtree(tmp_project / "docs")
        with patch.object(ex, "ROOT", tmp_project):
            result = executor._load_guardrails()
        assert "Rules" in result
        assert "Architecture" not in result

    def test_empty_project(self, tmp_path):
        with patch.object(ex, "ROOT", tmp_path):
            # executor가 필요 없는 static-like 동작이므로 임시 인스턴스
            phases_dir = tmp_path / "phases" / "dummy"
            phases_dir.mkdir(parents=True)
            idx = {"project": "T", "phase": "t", "steps": []}
            (phases_dir / "index.json").write_text(json.dumps(idx))
            inst = ex.StepExecutor.__new__(ex.StepExecutor)
            result = inst._load_guardrails()
        assert result == ""


# ---------------------------------------------------------------------------
# _build_step_context
# ---------------------------------------------------------------------------

class TestBuildStepContext:
    def test_includes_completed_with_summary(self, phase_dir):
        index = json.loads((phase_dir / "index.json").read_text())
        result = ex.StepExecutor._build_step_context(index)
        assert "Step 0 (setup): 프로젝트 초기화 완료" in result
        assert "Step 1 (core): 핵심 로직 구현" in result

    def test_excludes_pending(self, phase_dir):
        index = json.loads((phase_dir / "index.json").read_text())
        result = ex.StepExecutor._build_step_context(index)
        assert "ui" not in result

    def test_excludes_completed_without_summary(self, phase_dir):
        index = json.loads((phase_dir / "index.json").read_text())
        del index["steps"][0]["summary"]
        result = ex.StepExecutor._build_step_context(index)
        assert "setup" not in result
        assert "core" in result

    def test_empty_when_no_completed(self):
        index = {"steps": [{"step": 0, "name": "a", "status": "pending"}]}
        result = ex.StepExecutor._build_step_context(index)
        assert result == ""

    def test_has_header(self, phase_dir):
        index = json.loads((phase_dir / "index.json").read_text())
        result = ex.StepExecutor._build_step_context(index)
        assert result.startswith("## 이전 Step 산출물")


# ---------------------------------------------------------------------------
# _build_preamble
# ---------------------------------------------------------------------------

class TestBuildPreamble:
    def test_includes_project_name(self, executor):
        result = executor._build_preamble("", "")
        assert "TestProject" in result

    def test_includes_guardrails(self, executor):
        result = executor._build_preamble("GUARD_CONTENT", "")
        assert "GUARD_CONTENT" in result

    def test_includes_step_context(self, executor):
        ctx = "## 이전 Step 산출물\n\n- Step 0: done"
        result = executor._build_preamble("", ctx)
        assert "이전 Step 산출물" in result

    def test_includes_commit_example(self, executor):
        result = executor._build_preamble("", "")
        assert "feat(mvp):" in result

    def test_includes_rules(self, executor):
        result = executor._build_preamble("", "")
        assert "작업 규칙" in result
        assert "AC" in result

    def test_no_retry_section_by_default(self, executor):
        result = executor._build_preamble("", "")
        assert "이전 시도 실패" not in result

    def test_retry_section_with_prev_error(self, executor):
        result = executor._build_preamble("", "", prev_error="타입 에러 발생")
        assert "이전 시도 실패" in result
        assert "타입 에러 발생" in result

    def test_includes_max_retries(self, executor):
        result = executor._build_preamble("", "")
        assert str(ex.StepExecutor.MAX_RETRIES) in result

    def test_includes_index_path(self, executor):
        result = executor._build_preamble("", "")
        assert "/phases/0-mvp/index.json" in result

    def test_includes_ci_gate(self, executor):
        result = executor._build_preamble("", "")
        assert "npm run lint" in result
        assert "npm run typecheck" in result
        assert "npm run test" in result
        assert "npm run build" in result

    def test_includes_docker_gate(self, executor):
        result = executor._build_preamble("", "")
        assert "docker build" in result


# ---------------------------------------------------------------------------
# _update_top_index
# ---------------------------------------------------------------------------

class TestUpdateTopIndex:
    def test_completed(self, executor, top_index):
        executor._top_index_file = top_index
        executor._update_top_index("completed")
        data = json.loads(top_index.read_text())
        mvp = next(p for p in data["phases"] if p["dir"] == "0-mvp")
        assert mvp["status"] == "completed"
        assert "completed_at" in mvp

    def test_error(self, executor, top_index):
        executor._top_index_file = top_index
        executor._update_top_index("error")
        data = json.loads(top_index.read_text())
        mvp = next(p for p in data["phases"] if p["dir"] == "0-mvp")
        assert mvp["status"] == "error"
        assert "failed_at" in mvp

    def test_blocked(self, executor, top_index):
        executor._top_index_file = top_index
        executor._update_top_index("blocked")
        data = json.loads(top_index.read_text())
        mvp = next(p for p in data["phases"] if p["dir"] == "0-mvp")
        assert mvp["status"] == "blocked"
        assert "blocked_at" in mvp

    def test_other_phases_unchanged(self, executor, top_index):
        executor._top_index_file = top_index
        executor._update_top_index("completed")
        data = json.loads(top_index.read_text())
        polish = next(p for p in data["phases"] if p["dir"] == "1-polish")
        assert polish["status"] == "pending"

    def test_nonexistent_dir_is_noop(self, executor, top_index):
        executor._top_index_file = top_index
        executor._phase_dir_name = "no-such-dir"
        original = json.loads(top_index.read_text())
        executor._update_top_index("completed")
        after = json.loads(top_index.read_text())
        for p_before, p_after in zip(original["phases"], after["phases"]):
            assert p_before["status"] == p_after["status"]

    def test_no_top_index_file(self, executor, tmp_path):
        executor._top_index_file = tmp_path / "nonexistent.json"
        executor._update_top_index("completed")  # should not raise


# ---------------------------------------------------------------------------
# _checkout_branch (mocked)
# ---------------------------------------------------------------------------

class TestCheckoutBranch:
    def _mock_git(self, executor, responses):
        call_idx = {"i": 0}
        def fake_git(*args):
            idx = call_idx["i"]
            call_idx["i"] += 1
            if idx < len(responses):
                return responses[idx]
            return MagicMock(returncode=0, stdout="", stderr="")
        executor._run_git = fake_git

    def test_already_on_branch(self, executor):
        self._mock_git(executor, [
            MagicMock(returncode=0, stdout="feat-mvp\n", stderr=""),
        ])
        executor._checkout_branch()  # should return without checkout

    def test_branch_exists_checkout(self, executor):
        self._mock_git(executor, [
            MagicMock(returncode=0, stdout="main\n", stderr=""),
            MagicMock(returncode=0, stdout="", stderr=""),
            MagicMock(returncode=0, stdout="", stderr=""),
        ])
        executor._checkout_branch()

    def test_branch_not_exists_create(self, executor):
        self._mock_git(executor, [
            MagicMock(returncode=0, stdout="main\n", stderr=""),
            MagicMock(returncode=1, stdout="", stderr="not found"),
            MagicMock(returncode=0, stdout="", stderr=""),
        ])
        executor._checkout_branch()

    def test_checkout_fails_exits(self, executor):
        self._mock_git(executor, [
            MagicMock(returncode=0, stdout="main\n", stderr=""),
            MagicMock(returncode=1, stdout="", stderr=""),
            MagicMock(returncode=1, stdout="", stderr="dirty tree"),
        ])
        with pytest.raises(SystemExit) as exc_info:
            executor._checkout_branch()
        assert exc_info.value.code == 1

    def test_no_git_exits(self, executor):
        self._mock_git(executor, [
            MagicMock(returncode=1, stdout="", stderr="not a git repo"),
        ])
        with pytest.raises(SystemExit) as exc_info:
            executor._checkout_branch()
        assert exc_info.value.code == 1


# ---------------------------------------------------------------------------
# _commit_step (mocked)
# ---------------------------------------------------------------------------

class TestCommitStep:
    def test_two_phase_commit(self, executor):
        calls = []
        def fake_git(*args):
            calls.append(args)
            if args[:2] == ("diff", "--cached"):
                return MagicMock(returncode=1)
            return MagicMock(returncode=0, stdout="", stderr="")
        executor._run_git = fake_git

        executor._commit_step(2, "ui")

        commit_calls = [c for c in calls if c[0] == "commit"]
        assert len(commit_calls) == 2
        assert "feat(mvp):" in commit_calls[0][2]
        assert "chore(mvp):" in commit_calls[1][2]

    def test_no_code_changes_skips_feat_commit(self, executor):
        call_count = {"diff": 0}
        calls = []
        def fake_git(*args):
            calls.append(args)
            if args[:2] == ("diff", "--cached"):
                call_count["diff"] += 1
                if call_count["diff"] == 1:
                    return MagicMock(returncode=0)
                return MagicMock(returncode=1)
            return MagicMock(returncode=0, stdout="", stderr="")
        executor._run_git = fake_git

        executor._commit_step(2, "ui")

        commit_msgs = [c[2] for c in calls if c[0] == "commit"]
        assert len(commit_msgs) == 1
        assert "chore" in commit_msgs[0]


# ---------------------------------------------------------------------------
# _invoke_claude (mocked)
# ---------------------------------------------------------------------------

class TestInvokeClaude:
    def test_invokes_claude_with_correct_args(self, executor):
        mock_result = MagicMock(returncode=0, stdout='{"result": "ok"}', stderr="")
        step = {"step": 2, "name": "ui"}
        preamble = "PREAMBLE\n"

        with patch("subprocess.run", return_value=mock_result) as mock_run:
            output = executor._invoke_claude(step, preamble)

        cmd = mock_run.call_args[0][0]
        assert cmd[0] == "claude"
        assert "-p" in cmd
        assert "--dangerously-skip-permissions" in cmd
        assert "--output-format" in cmd
        assert "PREAMBLE" in cmd[-1]
        assert "UI를 구현하세요" in cmd[-1]

    def test_saves_output_json(self, executor):
        mock_result = MagicMock(returncode=0, stdout='{"ok": true}', stderr="")
        step = {"step": 2, "name": "ui"}

        with patch("subprocess.run", return_value=mock_result):
            executor._invoke_claude(step, "preamble")

        output_file = executor._phase_dir / "step2-output.json"
        assert output_file.exists()
        data = json.loads(output_file.read_text())
        assert data["step"] == 2
        assert data["name"] == "ui"
        assert data["exitCode"] == 0

    def test_nonexistent_step_file_exits(self, executor):
        step = {"step": 99, "name": "nonexistent"}
        with pytest.raises(SystemExit) as exc_info:
            executor._invoke_claude(step, "preamble")
        assert exc_info.value.code == 1

    def test_timeout_is_1800(self, executor):
        mock_result = MagicMock(returncode=0, stdout="{}", stderr="")
        step = {"step": 2, "name": "ui"}

        with patch("subprocess.run", return_value=mock_result) as mock_run:
            executor._invoke_claude(step, "preamble")

        assert mock_run.call_args[1]["timeout"] == 1800

    def test_timeout_returns_error_output(self, executor):
        step = {"step": 2, "name": "ui"}

        with patch("subprocess.run", side_effect=subprocess.TimeoutExpired(cmd="claude", timeout=1800)):
            output = executor._invoke_claude(step, "preamble")

        assert output["exitCode"] == -1
        assert "TimeoutExpired" in output["stderr"]


# ---------------------------------------------------------------------------
# progress_indicator (= 이전 Spinner)
# ---------------------------------------------------------------------------

class TestProgressIndicator:
    def test_context_manager(self):
        import time
        with ex.progress_indicator("test") as pi:
            time.sleep(0.15)
        assert pi.elapsed >= 0.1

    def test_elapsed_increases(self):
        import time
        with ex.progress_indicator("test") as pi:
            time.sleep(0.2)
        assert pi.elapsed > 0


# ---------------------------------------------------------------------------
# main() CLI 파싱 (mocked)
# ---------------------------------------------------------------------------

class TestMainCli:
    def test_no_args_exits(self):
        with patch("sys.argv", ["execute.py"]):
            with pytest.raises(SystemExit) as exc_info:
                ex.main()
            assert exc_info.value.code == 2  # argparse exits with 2

    def test_invalid_phase_dir_exits(self):
        with patch("sys.argv", ["execute.py", "nonexistent"]):
            with patch.object(ex, "ROOT", Path("/tmp/fake_nonexistent")):
                with pytest.raises(SystemExit) as exc_info:
                    ex.main()
                assert exc_info.value.code == 1

    def test_missing_index_exits(self, tmp_project):
        (tmp_project / "phases" / "empty").mkdir()
        with patch("sys.argv", ["execute.py", "empty"]):
            with patch.object(ex, "ROOT", tmp_project):
                with pytest.raises(SystemExit) as exc_info:
                    ex.main()
                assert exc_info.value.code == 1


# ---------------------------------------------------------------------------
# _check_blockers (= 이전 main() error/blocked 체크)
# ---------------------------------------------------------------------------

class TestCheckBlockers:
    def _make_executor_with_steps(self, tmp_project, steps):
        d = tmp_project / "phases" / "test-phase"
        d.mkdir(exist_ok=True)
        index = {"project": "T", "phase": "test", "steps": steps}
        (d / "index.json").write_text(json.dumps(index))

        with patch.object(ex, "ROOT", tmp_project):
            inst = ex.StepExecutor.__new__(ex.StepExecutor)
        inst._root = str(tmp_project)
        inst._phases_dir = tmp_project / "phases"
        inst._phase_dir = d
        inst._phase_dir_name = "test-phase"
        inst._index_file = d / "index.json"
        inst._top_index_file = tmp_project / "phases" / "index.json"
        inst._phase_name = "test"
        inst._total = len(steps)
        return inst

    def test_error_step_exits_1(self, tmp_project):
        steps = [
            {"step": 0, "name": "ok", "status": "completed"},
            {"step": 1, "name": "bad", "status": "error", "error_message": "fail"},
        ]
        inst = self._make_executor_with_steps(tmp_project, steps)
        with patch("subprocess.run", return_value=MagicMock(returncode=0)):
            with pytest.raises(SystemExit) as exc_info:
                inst._check_blockers()
        assert exc_info.value.code == 1

    def test_blocked_step_exits_2(self, tmp_project):
        steps = [
            {"step": 0, "name": "ok", "status": "completed"},
            {"step": 1, "name": "stuck", "status": "blocked", "blocked_reason": "API key"},
        ]
        inst = self._make_executor_with_steps(tmp_project, steps)
        with patch("subprocess.run", return_value=MagicMock(returncode=0)):
            with pytest.raises(SystemExit) as exc_info:
                inst._check_blockers()
        assert exc_info.value.code == 2


# ---------------------------------------------------------------------------
# _ensure_created_at
# ---------------------------------------------------------------------------

class TestEnsureCreatedAt:
    def test_sets_created_at_when_missing(self, executor):
        index = json.loads(executor._index_file.read_text())
        assert "created_at" not in index

        executor._ensure_created_at()

        index = json.loads(executor._index_file.read_text())
        assert "created_at" in index
        assert "+0900" in index["created_at"]

    def test_does_not_overwrite_existing(self, executor):
        index = json.loads(executor._index_file.read_text())
        index["created_at"] = "2020-01-01T00:00:00+0900"
        executor._index_file.write_text(json.dumps(index))

        executor._ensure_created_at()

        index = json.loads(executor._index_file.read_text())
        assert index["created_at"] == "2020-01-01T00:00:00+0900"


# ---------------------------------------------------------------------------
# _execute_single_step (mocked)
# ---------------------------------------------------------------------------

class TestExecuteSingleStep:
    def _make_executor_for_step(self, tmp_project, steps, step_md_content="# Step"):
        d = tmp_project / "phases" / "test-exec"
        d.mkdir(exist_ok=True)
        index = {"project": "T", "phase": "test", "steps": steps}
        (d / "index.json").write_text(json.dumps(index))
        for s in steps:
            md = d / f"step{s['step']}.md"
            if not md.exists():
                md.write_text(step_md_content)

        with patch.object(ex, "ROOT", tmp_project):
            inst = ex.StepExecutor.__new__(ex.StepExecutor)
        inst._root = str(tmp_project)
        inst._phases_dir = tmp_project / "phases"
        inst._phase_dir = d
        inst._phase_dir_name = "test-exec"
        inst._index_file = d / "index.json"
        inst._top_index_file = tmp_project / "phases" / "index.json"
        inst._phase_name = "test"
        inst._project = "T"
        inst._total = len(steps)
        inst._auto_push = False
        # mock git
        inst._run_git = lambda *args: MagicMock(returncode=0, stdout="", stderr="")
        return inst

    def test_completed_on_first_try(self, tmp_project):
        steps = [{"step": 0, "name": "a", "status": "pending"}]
        inst = self._make_executor_for_step(tmp_project, steps)

        def fake_invoke(step, preamble):
            # Claude 세션이 index.json을 completed로 업데이트하는 것을 시뮬레이션
            index = json.loads(inst._index_file.read_text())
            index["steps"][0]["status"] = "completed"
            index["steps"][0]["summary"] = "done"
            inst._index_file.write_text(json.dumps(index))
            return {"step": 0, "name": "a", "exitCode": 0, "stdout": "", "stderr": ""}

        inst._invoke_claude = fake_invoke
        result = inst._execute_single_step(steps[0], "guardrails")
        assert result is True

        index = json.loads(inst._index_file.read_text())
        assert index["steps"][0]["status"] == "completed"
        assert "completed_at" in index["steps"][0]

    def test_retries_on_error_then_completes(self, tmp_project):
        steps = [{"step": 0, "name": "a", "status": "pending"}]
        inst = self._make_executor_for_step(tmp_project, steps)

        call_count = {"n": 0}
        def fake_invoke(step, preamble):
            call_count["n"] += 1
            index = json.loads(inst._index_file.read_text())
            if call_count["n"] < 2:
                index["steps"][0]["status"] = "error"
                index["steps"][0]["error_message"] = "type error"
            else:
                index["steps"][0]["status"] = "completed"
                index["steps"][0]["summary"] = "fixed"
            inst._index_file.write_text(json.dumps(index))
            return {"step": 0, "name": "a", "exitCode": 0, "stdout": "", "stderr": ""}

        inst._invoke_claude = fake_invoke
        with patch("time.sleep"):
            result = inst._execute_single_step(steps[0], "guardrails")
        assert result is True
        assert call_count["n"] == 2

    def test_max_retries_then_exits(self, tmp_project):
        steps = [{"step": 0, "name": "a", "status": "pending"}]
        inst = self._make_executor_for_step(tmp_project, steps)

        def fake_invoke(step, preamble):
            index = json.loads(inst._index_file.read_text())
            index["steps"][0]["status"] = "error"
            index["steps"][0]["error_message"] = "persistent failure"
            inst._index_file.write_text(json.dumps(index))
            return {"step": 0, "name": "a", "exitCode": 1, "stdout": "", "stderr": ""}

        # top index 필요
        top = {"phases": [{"dir": "test-exec", "status": "pending"}]}
        inst._top_index_file.parent.mkdir(parents=True, exist_ok=True)
        inst._top_index_file.write_text(json.dumps(top))

        inst._invoke_claude = fake_invoke
        with patch("time.sleep"):
            with pytest.raises(SystemExit) as exc_info:
                inst._execute_single_step(steps[0], "guardrails")
        assert exc_info.value.code == 1

    def test_blocked_exits_immediately(self, tmp_project):
        steps = [{"step": 0, "name": "a", "status": "pending"}]
        inst = self._make_executor_for_step(tmp_project, steps)

        def fake_invoke(step, preamble):
            index = json.loads(inst._index_file.read_text())
            index["steps"][0]["status"] = "blocked"
            index["steps"][0]["blocked_reason"] = "API key needed"
            inst._index_file.write_text(json.dumps(index))
            return {"step": 0, "name": "a", "exitCode": 0, "stdout": "", "stderr": ""}

        top = {"phases": [{"dir": "test-exec", "status": "pending"}]}
        inst._top_index_file.parent.mkdir(parents=True, exist_ok=True)
        inst._top_index_file.write_text(json.dumps(top))

        inst._invoke_claude = fake_invoke
        with pytest.raises(SystemExit) as exc_info:
            inst._execute_single_step(steps[0], "guardrails")
        assert exc_info.value.code == 2


# ---------------------------------------------------------------------------
# _execute_all_steps (mocked)
# ---------------------------------------------------------------------------

class TestExecuteAllSteps:
    def test_skips_completed_runs_pending(self, tmp_project):
        d = tmp_project / "phases" / "test-all"
        d.mkdir(parents=True)
        steps = [
            {"step": 0, "name": "done", "status": "completed", "summary": "ok"},
            {"step": 1, "name": "todo", "status": "pending"},
        ]
        index = {"project": "T", "phase": "test", "steps": steps}
        (d / "index.json").write_text(json.dumps(index))
        (d / "step1.md").write_text("# Step 1")

        with patch.object(ex, "ROOT", tmp_project):
            inst = ex.StepExecutor.__new__(ex.StepExecutor)
        inst._root = str(tmp_project)
        inst._phases_dir = tmp_project / "phases"
        inst._phase_dir = d
        inst._phase_dir_name = "test-all"
        inst._index_file = d / "index.json"
        inst._top_index_file = tmp_project / "phases" / "index.json"
        inst._phase_name = "test"
        inst._total = 2

        executed_steps = []
        def fake_execute_single(step, guardrails):
            executed_steps.append(step["step"])
            index_data = json.loads(inst._index_file.read_text())
            for s in index_data["steps"]:
                if s["step"] == step["step"]:
                    s["status"] = "completed"
                    s["summary"] = "done"
            inst._index_file.write_text(json.dumps(index_data))
            return True

        inst._execute_single_step = fake_execute_single
        inst._execute_all_steps("guardrails")

        assert executed_steps == [1]

    def test_records_started_at(self, tmp_project):
        d = tmp_project / "phases" / "test-ts"
        d.mkdir(parents=True)
        steps = [{"step": 0, "name": "a", "status": "pending"}]
        index = {"project": "T", "phase": "test", "steps": steps}
        (d / "index.json").write_text(json.dumps(index))
        (d / "step0.md").write_text("# Step 0")

        with patch.object(ex, "ROOT", tmp_project):
            inst = ex.StepExecutor.__new__(ex.StepExecutor)
        inst._root = str(tmp_project)
        inst._phases_dir = tmp_project / "phases"
        inst._phase_dir = d
        inst._phase_dir_name = "test-ts"
        inst._index_file = d / "index.json"
        inst._top_index_file = tmp_project / "phases" / "index.json"
        inst._phase_name = "test"
        inst._total = 1
        inst.TZ = ex.StepExecutor.TZ

        def fake_execute_single(step, guardrails):
            idx = json.loads(inst._index_file.read_text())
            for s in idx["steps"]:
                if s["step"] == step["step"]:
                    s["status"] = "completed"
                    s["summary"] = "ok"
            inst._index_file.write_text(json.dumps(idx))
            return True

        inst._execute_single_step = fake_execute_single
        inst._execute_all_steps("guardrails")

        idx = json.loads(inst._index_file.read_text())
        assert "started_at" in idx["steps"][0]


# ---------------------------------------------------------------------------
# _finalize (mocked)
# ---------------------------------------------------------------------------

class TestFinalize:
    def test_sets_completed_at(self, executor, top_index):
        executor._top_index_file = top_index
        executor._auto_push = False
        executor._finalize()

        index = json.loads(executor._index_file.read_text())
        assert "completed_at" in index

    def test_updates_top_index(self, executor, top_index):
        executor._top_index_file = top_index
        executor._auto_push = False
        executor._finalize()

        data = json.loads(top_index.read_text())
        mvp = next(p for p in data["phases"] if p["dir"] == "0-mvp")
        assert mvp["status"] == "completed"

    def test_auto_push_calls_git_push(self, executor, top_index):
        executor._top_index_file = top_index
        executor._auto_push = True
        executor._phase_name = "mvp"

        push_called = {"called": False}
        original_run_git = executor._run_git
        def fake_git(*args):
            if args[0] == "push":
                push_called["called"] = True
                assert "-u" in args
                assert "origin" in args
                return MagicMock(returncode=0, stdout="", stderr="")
            if args[:2] == ("diff", "--cached"):
                return MagicMock(returncode=0)  # no changes to commit
            return MagicMock(returncode=0, stdout="", stderr="")
        executor._run_git = fake_git

        executor._finalize()
        assert push_called["called"] is True

    def test_push_failure_exits(self, executor, top_index):
        executor._top_index_file = top_index
        executor._auto_push = True
        executor._phase_name = "mvp"

        def fake_git(*args):
            if args[0] == "push":
                return MagicMock(returncode=1, stdout="", stderr="rejected")
            if args[:2] == ("diff", "--cached"):
                return MagicMock(returncode=0)
            return MagicMock(returncode=0, stdout="", stderr="")
        executor._run_git = fake_git

        with pytest.raises(SystemExit) as exc_info:
            executor._finalize()
        assert exc_info.value.code == 1
