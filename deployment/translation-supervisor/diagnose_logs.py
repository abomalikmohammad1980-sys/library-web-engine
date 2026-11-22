"""Print bounded operational signals from a Kaggle notebook log, never source text."""

import collections
import json
import re
import sys
import time

from kaggle import api
from kagglesdk.kernels.types.kernels_api_service import ApiGetKernelSessionLogsStreamRequest


def summarize(lines):
    validation = collections.Counter()
    failures = collections.Counter()
    queue = None
    current = None
    counters = collections.Counter()
    for line in lines:
        counters["lines"] += 1
        match = re.search(r"Local validation rejected: ([a-z-]+)/([a-z]+): ([a-z_]+)", line)
        if match:
            validation["/".join(match.groups())] += 1
        match = re.search(r"Failed: ([a-z-]+)\s*\|\s*[a-f0-9]{64}\s*\|\s*([a-z_]+)", line)
        if match:
            failures["/".join(match.groups())] += 1
        match = re.search(r"Cloudflare \| completed=(\d+) \| pending=(\d+) \| processing=(\d+) \| failed=(\d+) \| throughput=(\d+)/min", line)
        if match:
            queue = tuple(map(int, match.groups()))
            counters["queue_samples"] += 1
        match = re.search(r"current language=([a-z-]+) .* source=([a-z-]+)", line)
        if match:
            current = match.groups()
        for marker in ("Saved:", "Completed:", "Paused:", "Local correction accepted:", "No claimable", "Traceback"):
            if marker in line:
                counters[marker] += 1
    return {"counters": counters, "validation": validation, "failures": failures,
            "lastQueue": queue, "lastCurrent": current}


def main():
    version = int(sys.argv[1])
    api.authenticate()
    with api.build_kaggle_client() as client:
        req = ApiGetKernelSessionLogsStreamRequest()
        req.user_name = "abomalik1980"
        req.kernel_slug = "khzanah-kaggle-cloudflare-urdu"
        req.version_label = f"v{version}"
        req.wait_for_logs_url_seconds = 1
        response = client.kernels.kernels_api_client.get_kernel_session_logs_stream(req)
        start = time.monotonic()
        lines = []
        try:
            for raw in response.iter_lines():
                lines.append(raw.decode("utf-8", errors="replace"))
                if len(lines) >= 40000 or time.monotonic() - start > 20:
                    break
        finally:
            response.close()
    print(json.dumps({"version": version, **summarize(lines)}, ensure_ascii=True))


if __name__ == "__main__":
    main()
