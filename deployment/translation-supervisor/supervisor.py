"""Conservative, cloud-run Kaggle supervisor for Khzanah's free translation lane.

The runner has no model or translation credentials. Kaggle and Cloudflare retain
their existing secrets. This script never deploys a Cloudflare Worker.
"""

import ast
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
from urllib.request import Request, urlopen


KERNEL = "abomalik1980/khzanah-kaggle-cloudflare-urdu"
BASE = "https://khzanah.com/api/translate/"
HERE = Path(__file__).resolve().parent
EXPECTED_SOURCES = {
    "local-agent/agent.mjs", "local-agent/client.mjs",
    "local-agent/capacity.mjs", "src/local-policy.mjs",
}
TERMINAL = {"COMPLETE", "CANCEL_ACKNOWLEDGED", "ERROR"}
ACTIVE = {"RUNNING", "QUEUED", "PENDING", "STARTING"}


def get_json(url):
    request = Request(url, headers={"User-Agent": "Mozilla/5.0 KhzanahSupervisor/1.0"})
    with urlopen(request, timeout=25) as response:
        return json.load(response)


def status_name(value):
    return str(value).rsplit(".", 1)[-1].upper()


def remaining_total(automatic):
    rows = automatic.get("byLanguage") or {}
    if len(rows) != 36:
        raise ValueError("Expected progress for exactly 36 languages")
    return sum(int(item["remaining"]) for item in rows.values())


def choose(status, is_gpu, free_gpu_hours, summary, automatic, failure=""):
    if remaining_total(automatic) == 0:
        return "complete"
    if int(summary.get("completedLanguages", -1)) == 22:
        return "kaggle_complete_other_providers_remaining"
    if status in ACTIVE:
        if not is_gpu and free_gpu_hours >= 0.25:
            return "stop_cpu_for_gpu"
        return "healthy" if not summary.get("stalled") else "wait_for_notebook_guard"
    if status not in TERMINAL:
        return "unknown_session_state"
    if status == "ERROR":
        detail = failure.lower()
        if "no verified translation progress" in detail or "no verified cloudflare progress" in detail:
            return "diagnose_error"
        if not any(word in detail for word in ("time limit", "quota", "max duration", "runtime limit", "12 hours")):
            return "diagnose_error"
    return "start_gpu" if free_gpu_hours >= 0.25 else "start_cpu"


def source_assignment(notebook):
    cells = [cell for cell in notebook["cells"] if cell["cell_type"] == "code"]
    if len(cells) != 1:
        raise ValueError("Notebook must have exactly one code cell")
    code = "".join(cells[0]["source"])
    matches = [node for node in ast.parse(code).body
               if isinstance(node, ast.Assign)
               and any(isinstance(target, ast.Name) and target.id == "SOURCES" for target in node.targets)]
    if len(matches) != 1:
        raise ValueError("Notebook must have exactly one SOURCES assignment")
    assignment = ast.get_source_segment(code, matches[0])
    sources = ast.literal_eval(matches[0].value)
    if set(sources) != EXPECTED_SOURCES or not all(isinstance(value, str) and value for value in sources.values()):
        raise ValueError("Embedded agent sources changed; require review")
    return cells[0], code, assignment, sources


def skeleton(notebook):
    try:
        _, code, assignment, _ = source_assignment(notebook)
    except ValueError:
        _, code, assignment, _ = source_assignment_allow_empty(notebook)
    return code.replace(assignment, "SOURCES = {}", 1)


def render_notebook(live, mode):
    templates = [json.loads((HERE / "templates" / f"{name}.ipynb").read_text(encoding="utf-8"))
                 for name in ("gpu", "cpu")]
    if skeleton(live) not in {skeleton(template) for template in templates}:
        raise ValueError("Live notebook runtime differs from reviewed templates")
    _, _, _, sources = source_assignment(live)
    template = templates[0 if mode == "gpu" else 1]
    cell, code, assignment, _ = source_assignment_allow_empty(template)
    updated = code.replace(assignment, "SOURCES = " + repr(sources), 1)
    ast.parse(updated)
    cell["source"] = updated.splitlines(keepends=True)
    cell["execution_count"] = None
    cell["outputs"] = []
    return template


def source_assignment_allow_empty(notebook):
    cell = [cell for cell in notebook["cells"] if cell["cell_type"] == "code"][0]
    code = "".join(cell["source"])
    nodes = [node for node in ast.parse(code).body if isinstance(node, ast.Assign)
             and any(isinstance(target, ast.Name) and target.id == "SOURCES" for target in node.targets)]
    if len(nodes) != 1 or ast.literal_eval(nodes[0].value) != {}:
        raise ValueError("Invalid stripped template")
    return cell, code, ast.get_source_segment(code, nodes[0]), {}


def kaggle_cli(*args, timeout=120):
    result = subprocess.run(["kaggle", *args], text=True, capture_output=True, timeout=timeout)
    if result.returncode:
        raise RuntimeError(f"Kaggle CLI {args[1]} failed (exit {result.returncode}); see Kaggle status")
    return result.stdout


def kaggle_snapshot():
    from kaggle import api
    from kagglesdk.kernels.types.kernels_api_service import ApiGetKernelRequest, ApiGetKernelSessionStatusRequest
    with api.build_kaggle_client() as client:
        kernels = client.kernels.kernels_api_client
        request = ApiGetKernelRequest()
        request.user_name, request.kernel_slug = KERNEL.split("/", 1)
        kernel = kernels.get_kernel(request)
        session = ApiGetKernelSessionStatusRequest()
        session.user_name, session.kernel_slug = request.user_name, request.kernel_slug
        state = kernels.get_kernel_session_status(session)
        gpu = kernels.get_accelerator_quota_statistics().gpu_quota
        if not gpu or gpu.is_pay_to_scale_enabled:
            raise RuntimeError("Free GPU mode not verified; refusing paid operation")
        free = max(0.0, (gpu.total_time_allowed - gpu.time_used).total_seconds() / 3600)
        return kernel, status_name(state.status), free, str(state.failure_message or "")


def stop_cpu_for_gpu():
    from kaggle import api
    from kagglesdk.kernels.types.kernels_api_service import ApiCancelKernelSessionRequest
    with api.build_kaggle_client() as client:
        kernel, status, _, _ = kaggle_snapshot()
        if status != "RUNNING" or kernel.metadata.enable_gpu:
            return "CPU no longer running; recheck next cycle"
        request = ApiCancelKernelSessionRequest()
        request.kernel_session_id = kernel.metadata.current_version_number
        client.kernels.kernels_api_client.cancel_kernel_session(request)
    return "CPU stop requested; await terminal confirmation before GPU push"


def push_mode(mode):
    with tempfile.TemporaryDirectory(prefix="khzanah-supervisor-") as temporary:
        folder = Path(temporary)
        kaggle_cli("kernels", "pull", KERNEL, "-p", str(folder), "-m")
        metadata_path = folder / "kernel-metadata.json"
        metadata = json.loads(metadata_path.read_text(encoding="utf-8"))
        if (metadata.get("id") != KERNEL or not metadata.get("is_private")
                or not metadata.get("enable_internet")
                or not metadata.get("dataset_sources") or not metadata.get("kernel_sources")):
            raise RuntimeError("Kaggle metadata changed; refusing push")
        code_file = metadata["code_file"]
        if Path(code_file).name != code_file or not code_file.endswith(".ipynb"):
            raise RuntimeError("Unexpected notebook code file")
        for item in folder.iterdir():
            if item.name not in {code_file, "kernel-metadata.json"}:
                raise RuntimeError("Unexpected downloaded file; refusing push")
        notebook = render_notebook(json.loads((folder / code_file).read_text(encoding="utf-8")), mode)
        metadata["enable_gpu"] = mode == "gpu"
        metadata["enable_tpu"] = False
        if mode == "gpu":
            metadata["machine_shape"] = "NvidiaTeslaT4"
        else:
            metadata.pop("machine_shape", None)
        metadata_path.write_text(json.dumps(metadata, ensure_ascii=False, indent=2), encoding="utf-8")
        (folder / code_file).write_text(json.dumps(notebook, ensure_ascii=False), encoding="utf-8")
        _, latest_status, _, _ = kaggle_snapshot()
        if latest_status not in TERMINAL:
            raise RuntimeError("Kaggle session became active during preparation; refusing duplicate")
        args = ["kernels", "push", "-p", str(folder)]
        if mode == "gpu":
            args.extend(["--accelerator", "NvidiaTeslaT4"])
        kaggle_cli(*args)
    return f"Submitted one free {mode.upper()} notebook run"


def main():
    if not os.environ.get("KAGGLE_API_TOKEN"):
        raise RuntimeError("KAGGLE_API_TOKEN must be configured as a GitHub Actions secret")
    automatic = get_json(BASE + "automatic")
    summary = get_json(BASE + "summary")
    kernel, status, gpu_hours, failure = kaggle_snapshot()
    logs = ""
    if status == "ERROR":
        try:
            logs = kaggle_cli("kernels", "logs", KERNEL, timeout=60)[-8000:]
        except Exception:
            logs = ""
    failure = (failure + "\n" + logs)[-9000:]
    decision = choose(status, bool(kernel.metadata.enable_gpu), gpu_hours, summary, automatic, failure)
    print(json.dumps({"version": kernel.metadata.current_version_number, "status": status,
                      "gpuHours": round(gpu_hours, 2), "language": summary.get("language"),
                      "ready": summary.get("ready"), "remaining": summary.get("remaining"),
                      "decision": decision}, ensure_ascii=False))
    if os.environ.get("SUPERVISOR_DRY_RUN") == "1":
        print("Dry run: no Kaggle mutation")
        return
    if decision in {"start_gpu", "start_cpu"}:
        print(push_mode(decision.split("_", 1)[1]))
    elif decision == "stop_cpu_for_gpu":
        try:
            print(stop_cpu_for_gpu())
        except Exception as error:
            print("CPU stop refused; user must stop the active Kaggle version:", type(error).__name__)
            raise
    elif decision == "diagnose_error":
        reasons = {reason: logs.count(reason) for reason in
                   ("validation_failed", "untranslated", "wrong_script", "numbers_changed",
                    "incomplete_generation", "No verified translation progress", "timeout")}
        raise RuntimeError("Kaggle error requires repair before retry: " + json.dumps(reasons))
    elif decision == "unknown_session_state":
        raise RuntimeError("Unknown Kaggle state; no action taken")


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        print(f"Supervisor stopped safely: {type(error).__name__}: {error}", file=sys.stderr)
        sys.exit(1)
