"""Read-only verification of the signed APK's public configuration and assets.
Never reads signing keys or prints matched content. Run after android-store-internal.
"""
import json
import re
import sys
from pathlib import Path
from zipfile import ZipFile

root = Path(__file__).resolve().parent.parent
candidate = "--public-candidate" in sys.argv
qa = "--billing-qa" in sys.argv
artifact = "Docked-billing-qa.apk" if qa else "Docked-public-candidate.apk" if candidate else "Docked-store-internal.apk"
with ZipFile(root / "artifacts/android" / artifact) as package:
    config = json.loads(package.read("assets/capacitor.config.json"))
    assert config["appId"] == "docked.fantasy"
    assert config["server"]["url"] == "https://docked.com.au/app"
    assert not config["server"].get("cleartext", False)
    assert not config["android"].get("allowMixedContent", False)
    assert not config["android"].get("webContentsDebuggingEnabled", False)
    assert config["loggingBehavior"] == "none"
    if candidate:
        assert not any("google_lab_ca" in entry.filename for entry in package.infolist())
        for entry in package.infolist():
            if entry.filename.endswith(".dex"):
                assert b"GoogleBillingLabActivity" not in package.read(entry), "QA launcher present in public candidate"
    count = 0
    for entry in package.infolist():
        if not entry.filename.startswith("assets/") or not re.search(r"\.(json|js|html|xml|map)$", entry.filename):
            continue
        text = package.read(entry).decode("utf-8", errors="replace")
        count += 1
        assert not re.search(r"BEGIN (RSA |EC )?PRIVATE KEY|sb_secret_|SUPABASE_SERVICE_ROLE_KEY|DOCKED_UPLOAD_STORE_PASSWORD", text), "Sensitive marker in packaged asset"
    evidence = dict(passed=True, applicationId=config["appId"], server=config["server"]["url"],
                    debugging=False, cleartext=False, mixedContent=False, assetsScanned=count,
                    scope="Pattern scan of packaged text assets; not a penetration test")
    destination = "docs/qa/hosted-member-20261101/native-security.json" if qa else "docs/qa/public-play-readiness-20261031/public-native-security.json" if candidate else "docs/qa/store-release-20261031/native-security.json"
    (root / destination).write_text(json.dumps(evidence, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(evidence))
