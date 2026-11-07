import ast
import json
from pathlib import Path
import subprocess
import unittest

import supervisor


def automatic(remaining=1):
    return {"byLanguage": {f"lang-{index}": {"remaining": remaining} for index in range(36)}}


class SupervisorTests(unittest.TestCase):
    def test_never_pushes_when_session_active(self):
        self.assertEqual(supervisor.choose("RUNNING", True, 2, {"completedLanguages": 0}, automatic()), "healthy")
        self.assertEqual(supervisor.choose("QUEUED", True, 2, {"completedLanguages": 0}, automatic()), "healthy")

    def test_cpu_handoff_requires_stop_first(self):
        self.assertEqual(supervisor.choose("RUNNING", False, 2, {"completedLanguages": 0}, automatic()), "stop_cpu_for_gpu")
        self.assertEqual(supervisor.choose("CANCEL_ACKNOWLEDGED", False, 2, {"completedLanguages": 0}, automatic()), "start_gpu")

    def test_cpu_handoff_waits_for_terminal_before_gpu(self):
        states = iter(("RUNNING", "CANCEL_ACKNOWLEDGED"))
        snapshot = lambda: (None, next(states), 2, "")
        self.assertTrue(supervisor.wait_for_terminal(snapshot, lambda _: None, attempts=2))
        self.assertFalse(supervisor.wait_for_terminal(
            lambda: (None, "RUNNING", 2, ""), lambda _: None, attempts=2))
        with self.assertRaises(RuntimeError):
            supervisor.wait_for_terminal(
                lambda: (None, "ERROR", 2, ""), lambda _: None, attempts=1)

    def test_free_quota_selection(self):
        self.assertEqual(supervisor.choose("COMPLETE", True, 0, {"completedLanguages": 0}, automatic()), "start_cpu")
        self.assertEqual(supervisor.choose("COMPLETE", False, 1, {"completedLanguages": 0}, automatic()), "start_gpu")

    def test_failure_does_not_cause_blind_restart(self):
        self.assertEqual(supervisor.choose("ERROR", True, 2, {"completedLanguages": 0}, automatic(), ""), "diagnose_error")
        self.assertEqual(supervisor.choose("ERROR", True, 2, {"completedLanguages": 0}, automatic(), "validation failed"), "diagnose_error")
        self.assertEqual(supervisor.choose("ERROR", True, 2, {"completedLanguages": 0}, automatic(), "time limit exceeded"), "start_gpu")
        self.assertEqual(supervisor.choose("ERROR", True, 2, {"completedLanguages": 0}, automatic(), "GPU quota available; No verified translation progress"), "diagnose_error")

    def test_all_36_or_all_22_completion(self):
        self.assertEqual(supervisor.choose("COMPLETE", True, 2, {"completedLanguages": 22}, automatic()), "kaggle_complete_other_providers_remaining")
        self.assertEqual(supervisor.choose("COMPLETE", True, 2, {"completedLanguages": 22}, automatic(0)), "complete")
        with self.assertRaises(ValueError):
            supervisor.remaining_total({"byLanguage": {"en": {"remaining": 0}}})

    def test_render_matches_reviewed_gpu_and_cpu(self):
        directory = Path(__file__).resolve().parent / "templates"
        dummy = {name: "export const sample = true;" for name in supervisor.EXPECTED_SOURCES}
        for live_name in ("gpu", "cpu", "legacy-gpu-v46", "legacy-cpu-v46",
                          "legacy-gpu-five-minute-stop", "legacy-cpu-five-minute-stop",
                          "legacy-gpu-v48", "legacy-cpu-v48"):
            live = json.loads((directory / f"{live_name}.ipynb").read_text(encoding="utf-8"))
            cell = live["cells"][1]
            cell["source"] = "".join(cell["source"]).replace("SOURCES = {}", "SOURCES = " + repr(dummy)).splitlines(keepends=True)
            for mode in ("gpu", "cpu"):
                rendered = supervisor.render_notebook(live, mode)
                self.assertEqual(supervisor.source_assignment(rendered)[3], dummy)
                expected = json.loads((directory / f"{mode}.ipynb").read_text(encoding="utf-8"))
                self.assertEqual(supervisor.skeleton(rendered), supervisor.skeleton(expected))

    def test_five_minute_monitor_does_not_stop_the_session(self):
        directory = Path(__file__).resolve().parent / "templates"
        for mode in ("gpu", "cpu"):
            notebook = json.loads((directory / f"{mode}.ipynb").read_text(encoding="utf-8"))
            code = "".join(notebook["cells"][1]["source"])
            self.assertEqual(code.count("5 * 60"), 1)
            self.assertIn("keeping " + mode.upper() + " session alive", code)
            self.assertNotIn("No verified translation progress for 5 minutes; stopping", code)
            self.assertNotIn("No verified Cloudflare progress for 5 minutes; stopping", code)
            helper = next(node for node in ast.walk(ast.parse(code))
                          if isinstance(node, ast.FunctionDef) and node.name == "accepted_count")
            namespace = {"kaggle_languages": tuple("en fr tr ur ug fa hi id ms bn ru uk de es pt it nl pl kk zh ja ko".split())}
            exec(compile(ast.Module(body=[helper], type_ignores=[]), "guard", "exec"), namespace)
            rows = {language: {"ready": 1} for language in namespace["kaggle_languages"]}
            rows["sw"] = {"ready": 1000}
            self.assertEqual(namespace["accepted_count"]({"byLanguage": rows}), 22)
            rows["sw"]["ready"] += 100
            self.assertEqual(namespace["accepted_count"]({"byLanguage": rows}), 22)
            rows["de"]["ready"] += 1
            self.assertEqual(namespace["accepted_count"]({"byLanguage": rows}), 23)
            del rows["de"]
            with self.assertRaises(ValueError):
                namespace["accepted_count"]({"byLanguage": rows})

    def test_stubborn_agent_does_not_fail_session_cleanup(self):
        class StubbornAgent:
            def __init__(self):
                self.waits = []
                self.terminated = False
                self.killed = False

            def wait(self, timeout):
                self.waits.append(timeout)
                if not self.killed:
                    raise subprocess.TimeoutExpired("agent", timeout)
                return 0

            def terminate(self):
                self.terminated = True

            def kill(self):
                self.killed = True

        directory = Path(__file__).resolve().parent / "templates"
        for mode, variable in (("gpu", "process"), ("cpu", "agent")):
            with self.subTest(mode=mode):
                notebook = json.loads((directory / f"{mode}.ipynb").read_text(encoding="utf-8"))
                code = "".join(notebook["cells"][1]["source"])
                cleanup = next(node for node in ast.walk(ast.parse(code))
                               if isinstance(node, ast.Try) and len(node.body) == 1
                               and isinstance(node.body[0], ast.Expr)
                               and isinstance(node.body[0].value, ast.Call)
                               and isinstance(node.body[0].value.func, ast.Attribute)
                               and node.body[0].value.func.attr == "wait"
                               and isinstance(node.body[0].value.func.value, ast.Name)
                               and node.body[0].value.func.value.id == variable
                               and any(isinstance(child, ast.Attribute) and child.attr == "terminate"
                                       for child in ast.walk(node)))
                agent = StubbornAgent()
                namespace = {variable: agent, "subprocess": subprocess}
                exec(compile(ast.Module(body=[cleanup], type_ignores=[]), "cleanup", "exec"), namespace)
                self.assertTrue(agent.terminated)
                self.assertTrue(agent.killed)
                self.assertEqual(agent.waits, [45, 15, 15])


if __name__ == "__main__":
    unittest.main()
