# Initial v4 candidate — preserved historical evidence

These are byte-for-byte copies of the initial v4 candidate's audit JSON files and durable artifact manifest, saved before the final receipt-matching rebuild. They are **historical candidate evidence, not the final delivery report**.

The initial candidate was 9,262,106 bytes with SHA-256 `f1d6089fc749626ade061b472e2aab6ac44c13e808c8fe8be78182718bf8238b`, package `au.com.docked.app.preview`, versionCode 4 (`1.3-preview`). Its packaged receipt identified deployment `dpl_JAYYcsWXXhR3Xyk9nMzgMFRVpp4R` and web source `bdef27942096d7463b469231cdd8410a9d5b130c`.

The exact binary remains in the verified, Git-ignored content-hash archive `private-data/android/apk-archive/f1d6089fc749626ade061b472e2aab6ac44c13e808c8fe8be78182718bf8238b/Docked-Preview-S24-v4-Mobile-App.apk`. [Preservation receipt](preservation.json) records hashes of the unchanged copied audit files and manifest. Existing v3 was also verified before rebuilding.

The Following screen received a scoped web layout/contrast correction after this candidate was built. The final v4 retains versionCode 4 because this candidate was not delivered; the later build packages the corrected deployment's verified receipt. The stable HTTPS origin remains unchanged. See the [current Android report](../README.md) for the final binary and evidence.

No emulator or physical-device acceptance was performed for this candidate. Artifact audit success does not establish physical S24 installation or native runtime acceptance.
