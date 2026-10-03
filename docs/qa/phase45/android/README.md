# Phase 4.5 Android v5 artifact

[Installable preview APK](../../../../artifacts/android/Docked-Preview-S24-v5-App-Entry.apk): **9,597,678 bytes**, SHA-256 `3e7af19503c376e8601ca9eef164a17d8a385b73f36aecff19a4a2629929552b`.

Package `au.com.docked.app.preview`; versionCode **5**, versionName **1.4-preview**; minimum API 24, target API 36; arm64 supported. The independently verified signing certificate is `38d427f45d24542f23e798b5692321044e68c8c929f7bd23773ac0872dedb66b`, matching the preserved v4 binary. No key was changed.

The APK opens `https://docked-preview-s24-briant-ginty.vercel.app/app`. Its embedded public receipt identifies verified Preview deployment `dpl_8Zs6gWmRJC4kL9sUL7WvLRYXXR3y`, source `f1d55a954644b122b57ccbed1b54207194552390`, and dedicated Preview Supabase project `bckkllmndoxzpzdqrevb`. All sending, billing, prize, affiliate and live-data gates remain closed. Production services were not modified.

| Verification | Actual result |
| --- | --- |
| Hosted preview build | PASS; Gradle 85s, 373 tasks, 50 executed. [Build receipt](build.json). |
| Every ZIP entry | PASS; 988 entries, no credential/forbidden-file findings. Both embedded offline documents contain the exact approved master image. [Archive audit](apk-audit.json). |
| Signature, package, upgrade and compiled network policy | PASS against the actual v4 binary; non-debuggable, HTTPS only, no WebView inspection. [Identity audit](apk-details.json). |
| Indexed extraction | PASS; all 988 files, 17,634,155 uncompressed bytes; case-colliding Android resource names preserved. [Extraction receipt](apk-extraction.json). |
| Strong binary/encoded secret scan | PASS; extracted APK plus synchronized assets, 996 files and 18,329,997 bytes, zero findings/errors. [Scan receipt](strong-secret-audit.json). |
| Actual temporary beta credentials | Separate whole-artifact scan is recorded by the main task in [phase-wide secret evidence](../actual-secret-audit.json). |
| V3, V4 and V5 preservation | PASS; durable binaries and independent content-hash archives rechecked. [Preservation receipt](preservation.json). |
| Offline browser rendering | PASS at 390px and 1366px, no network subresources, strict hashed CSP and zero Axe/console failures. [Final browser mapping](../browser-acceptance.json). |
| Play signing preflight | Correctly BLOCKED: owner upload keystore/alias/password inputs absent. No key, AAB or upload created. [Preflight receipt](closed-test-preflight.json). |

V4 remains byte-identical at SHA-256 `18fb07bcb4f1fc8d43ac1b1b9c974b56f902ec0a76e2ff4f53558a993af8e19e`. Its original manifest and evidence are preserved. No generated Android/public/mobile source changed during this v5 build.

The user reported v4 working on a physical S24. **V5 was not installed or tested on an emulator or physical device in this phase.** The build, static audits and browser checks do not prove v5 cold/warm launch, session persistence, background/resume, offline restoration, keyboard behavior, native back/share/photo-picker or device accessibility. These remain the next device checks. No native success is inferred from browser results.

The canonical D uses the installed app icon master without redrawing its interior. Wordmarks and offline images mask only the supplied raster's outer white corner frame; original source bytes are retained. The offline CSP generator normalises line endings before hashing, so Windows-generated styles match browser parsing without weakening CSP.
