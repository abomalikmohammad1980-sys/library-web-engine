"""Send one generic Telegram action alert; keep credentials out of logs."""

import os
from pathlib import Path
import sys
from urllib.parse import urlencode
from urllib.request import Request, urlopen


def main():
    token = os.environ.get("TELEGRAM_STATUS_BOT_TOKEN")
    chat_id = os.environ.get("TELEGRAM_STATUS_CHAT_ID")
    marker = Path(sys.argv[1])
    if not token or not chat_id:
        print("Telegram alert secrets missing; no alert sent")
        raise SystemExit(1)
    run_url = os.environ.get("GITHUB_SERVER_URL", "https://github.com") + "/" + os.environ["GITHUB_REPOSITORY"] + "/actions/runs/" + os.environ["GITHUB_RUN_ID"]
    text = "⚠️ مشرف ترجمة الخزانة يحتاج تدخلًا. لم يُشغّل نسخة Kaggle إضافية دون تحقق. التفاصيل: " + run_url
    data = urlencode({"chat_id": chat_id, "text": text, "disable_web_page_preview": "true"}).encode()
    request = Request("https://api.telegram.org/bot" + token + "/sendMessage", data=data, method="POST")
    try:
        with urlopen(request, timeout=15) as response:
            if response.status != 200:
                raise RuntimeError("Telegram rejected the alert")
    except Exception:
        print("Telegram alert failed; inspect bot destination in GitHub secrets", file=sys.stderr)
        raise SystemExit(1) from None
    marker.parent.mkdir(parents=True, exist_ok=True)
    marker.write_text("sent\n", encoding="ascii")
    print("One Telegram alert sent")


if __name__ == "__main__":
    main()
