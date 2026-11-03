import json
from pathlib import Path
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
        template = Path(__file__).resolve().parent / "templates" / "gpu.ipynb"
        live = json.loads(template.read_text(encoding="utf-8"))
        cell = live["cells"][1]
        dummy = {name: "export const sample = true;" for name in supervisor.EXPECTED_SOURCES}
        cell["source"] = "".join(cell["source"]).replace("SOURCES = {}", "SOURCES = " + repr(dummy)).splitlines(keepends=True)
        for mode in ("gpu", "cpu"):
            rendered = supervisor.render_notebook(live, mode)
            self.assertEqual(supervisor.source_assignment(rendered)[3], dummy)
            self.assertEqual(supervisor.skeleton(rendered), supervisor.skeleton(
                json.loads((template.parent / f"{mode}.ipynb").read_text(encoding="utf-8"))))


if __name__ == "__main__":
    unittest.main()
