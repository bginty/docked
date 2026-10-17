# Docked execution-permission mismatch — 17 October 2026

## Resolved in this chat, 12:32 UTC

After the user selected Full access beneath this chat's composer, the effective
runtime reported danger-full-access with networking enabled. The single recheck
passed DNS, HTTPS, Supabase TCP, disposable Git writes, directory operations and
junction creation. Authenticated database access and the clean production build
also passed. No elevation, security-software change or policy bypass was used.
Probe receipt: `tmp/nfl-session-probe-1792240317878/result.json`.
The mismatch evidence below is retained as historical diagnostic context.

Status: confirmed mismatch between saved user configuration and effective task permissions. The ordinary Windows host comparison now passes DNS, HTTPS, database TCP, ordinary writes, build-directory creation and junction creation. The corresponding failures are confined to the Codex execution context in this comparison. The origin of the app-server default is not established; an application/configuration-propagation defect is suspected, not confirmed. No policy bypass or repair has been attempted.

## Versions and execution context

- Desktop: 26.1013.31256, build 20586, prod distribution. The app update check returned `up_to_date`; no installation performed.
- Actual bundled runtime: `0.163.0-alpha.10.2` from the command environment, under `<user>/AppData/Local/OpenAI/Codex/bin/e78bad9887fa50cf/codex.exe`.
- Separate PATH CLI: `0.145.0`; this is not the runtime executing this task.
- Actual shell: PowerShell 7.6.5 Core; Node 22.14.0. An earlier inspected Windows PowerShell binary version is not the active shell version.
- Local Windows, primary Docked checkout, not a remote machine or separate worktree. Desktop logs report `environmentIds=["local"]`.
- Native sandbox evidence: `CODEX_WINDOWS_SANDBOX_PACKAGE_FAMILY=OpenAI.Codex_2p2nqsd0c76g0`; LOCALAPPDATA resolves into a sandbox package AC directory. Recent sandbox log entries select `mxc`. Individual selection entries are not independently correlated to a thread.

## Saved settings versus actual permissions

The user reports Full access in the UI. The agent did not inspect the UI.

Read-only inspection of `<user>/.codex/config.toml` found:

```toml
sandbox_mode = "danger-full-access"
[windows]
sandbox = "elevated"
# The Docked project entry is trusted.
```

The file was modified at 22:52:10 AEDT. No project `.codex` configuration directory was found. No relevant root `profile`, `default_permissions`, or `approval_policy` assignment was found by the targeted inspection.

The task's persisted turn context at **11:55:56 UTC / 22:55:56 AEDT**, after that save, records:

```text
active_permission_profile.id = :workspace
sandbox_policy.type = workspace-write
sandbox_policy.network_access = false
approval_policy = on-request
approvals_reviewer = auto_review
permission_profile.type = managed
permission_profile.network = restricted
repository root = write
repository .git = read
```

The command environment independently confirms `CODEX_PERMISSION_PROFILE=:workspace` and `CODEX_SANDBOX_NETWORK_DISABLED=1`. Explicit current tool policy agrees. The word `managed` in this serialized permission object alone does not prove an organization administrator imposed it.

## Where the restriction enters

### Desktop selection evidence (latest follow-up)

The user's ordinary PowerShell process inspection found bundled app-server PID 16480 at the expected executable path. Its filtered command line contained none of the checked `thread_context`, `sandbox_mode`, `default_permissions`, `--sandbox`, `--permissions-profile`, `--profile`, or `--ignore-user-config` patterns. This reduces the likelihood of those direct launch overrides; it does not inspect configuration supplied later over RPC.

Read-only inspection of `.codex-global-state.json` then found this precise persisted local-host selection:

```json
{"kind":"agent-mode","agentMode":"guardian-approvals"}
```

Location: `electron-persisted-atom-state["permission-selection-by-host-id:local"]`. The current chat's entry in `heartbeat-thread-permissions-by-id` independently contains `activePermissionProfile.id=:workspace`, `approvalPolicy=on-request`, `approvalsReviewer=auto_review`, and `sandboxPolicy.networkAccess=false`. This is consistent with Approve for me, whose documented behavior retains the workspace sandbox and changes the approval reviewer. It is a concrete persisted selection that differs from the saved `sandbox_mode="danger-full-access"` user configuration. The agent has not inspected the visible composer selection, established why the state differs from the user's reported choice, or proved that this stored selection causes every server default.

A read-only lookup of this thread alone in `state_5.sqlite` agrees with its restricted filesystem/network policy. No app-state or SQLite write was performed. The supported next action is to inspect/select the mode in **this chat's permissions control beneath the composer**, then compare the persisted selection and effective runtime. If that control already visibly selects Full access while the stored selection remains guardian approvals, capture that discrepancy for support rather than repeatedly toggling or editing internal files.

References: https://learn.chatgpt.com/docs/permission-modes and https://learn.chatgpt.com/docs/sandboxing/auto-review .

### Deprecated-setting inspection (follow-up)

The current user `config.toml` does **not** contain the text `thread_context` or `guardianv2`, and has no inline profile sections. No sibling `*.config.toml` profile files were found. The inspected file remains 3,862 bytes, last modified 2026-10-17 22:52:10 AEDT. No edit was made because there was no deprecated entry to remove. Other settings were preserved.

Exact SHA-256: `9B19665512CCB29ACE05B9A42253CF68854B612CB9A6B057F10300BEBABB6B83`.

The warning is therefore not evidence that this particular file currently contains the key. Another loaded configuration source, an app-supplied override, or a retained warning remains possible. Desktop startup logs show the bundled app-server launched with ten arguments at 11:51:26 UTC, but log only the argument count, not their values. Inspecting the running app-server's relevant launch arguments from ordinary Windows is the next targeted read-only diagnostic. Do not remove or change an unrelated setting to suppress the warning.

For this exact chat, the desktop log at **11:55:32 UTC** records:

```text
hasExplicitPermissions=false
requestPermissionProfile=null
requestSandboxMode=null
responseActivePermissionProfile=:workspace
responseSandboxPolicy.type=workspaceWrite
responseSandboxPolicy.networkAccess=false
shouldSendPermissions=false
```

The subsequent turn-start log at **11:55:54 UTC** records:

```text
requestPermissionProfile=null
requestSandboxPolicyType=null
useAppServerPermissionDefault=true
resolvedApprovalPolicy=on-request
resolvedApprovalsReviewer=auto_review
```

This locates the observed restriction at the app-server default/session resolution boundary. It does not establish whether the source is an administrator requirement, app-server launch/default override, a different configuration context, or a defect. Logs show successful config/configRequirements reads but not the returned policy contents. Full launch arguments and policy provenance were not accessible from the current sandbox. No authoritative managed-requirement source was established.

Relevant local evidence (do not submit complete logs, which can contain unrelated private content):

- `<user>/.codex/sessions/2026/10/02/rollout-2026-10-02T21-06-13-01a0fc4b-1049-7211-91c9-af9141548b22.jsonl` — filtered `turn_context` fields only.
- `<user>/AppData/Local/Codex/Logs/2026/10/17/codex-desktop-9604581c-055a-433f-a468-38d87a94a2ad-15196-t0-i1-115103-0.log` — above events only.
- `<user>/.codex/.sandbox/sandbox.2026-10-17.log` — sandbox selection events.

## Failure isolation

- Existing same-day probes: ordinary workspace create/read/rename/delete passes; DNS fails with ENOTFOUND for Supabase API, verified direct DB hostname, saved session pooler, Vercel API and docked.com.au. PowerShell DNS also reported access denied. This is not evidence of a bad database password or a stale endpoint.
- Existing disposable junction probe: `EPERM`, operation `symlink`. Production-build failures include `.next/node_modules/sharp-20c6a5da84e2135f` junction creation and mkdir under `tmp/nfl-testing-build-1792231427291/.next/server/app/api/auth`.
- Prior Git probe failed with EPERM creating a unique temporary file. No new Git write probe was performed: current policy explicitly makes `.git` read-only. Git's index and existing lock were preserved.
- Existing ACL evidence includes sandbox deny entries and the Windows user's full-control entry. That does not establish that the ordinary Windows user cannot write. Host process/lock inspection was restricted; no unrelated process was stopped.
- Read-only Supabase and Vercel connector requests both succeeded again during this investigation. Supabase reports the Production project ACTIVE_HEALTHY; Vercel reports the existing Production deployment READY. These tools use a separate connection/execution path and do not prove shell networking works. No authentication failure was observed; no reconnect or credential rotation is warranted.
- Older legacy sandbox setup errors are not established as the cause of this native-MXC task. Changing legacy `windows.sandbox` is not an evidence-supported repair.
- No new elevation attempt, network-policy workaround, protected-directory write, ACL change, configuration edit, deployment, migration, import or card removal was performed.

## Reproduction and expected behavior

1. User reports selecting Full access, restarting and trying a new task; those UI steps were not observed by the agent.
2. Read the saved user configuration and confirm `danger-full-access` plus trusted project.
3. Start/resume this local task; inspect its filtered turn context and command environment.
4. Actual: app-server default resolves to `:workspace`, network disabled and `.git` read-only. Earlier permitted disposable probes fail as described above.
5. Expected: an allowed Full access selection is reflected in the task's effective permissions, or the UI identifies the overriding requirement. Do not retest prohibited writes while the restrictive policy remains active.

## Next diagnostic and supported resolution boundary

The prepared `tmp/docked-host-access-diagnostic.mjs` is for ordinary Windows PowerShell opened from Start, not this sandbox. It makes unauthenticated DNS/HTTPS/TCP checks and creates a unique disposable directory under repository `tmp` for ordinary writes, build mkdir and a junction. It does not write `.git`, load credentials, query databases, change policy, or deploy. It leaves its new probe directory for inspection. It refuses to run if Codex sandbox markers are present. Syntax was checked. The user ran it in ordinary Windows PowerShell and supplied the results below.

### Ordinary Windows host comparison: 2026-10-17T12:09:38.601Z

Evidence source: user-pasted output, not an agent-executed host command. Node v22.14.0; both Codex permission-profile and network-disabled environment markers were unset.

| Check | Result |
| --- | --- |
| Ordinary create/read/rename | PASS |
| Nested build directories | PASS |
| Directory junction | PASS |
| DNS: api.supabase.com | PASS, IPv6 and IPv4 |
| DNS: api.vercel.com | PASS, IPv4 |
| DNS: docked.com.au | PASS, IPv4 |
| DNS: verified direct Supabase DB | PASS, IPv6 |
| DNS: saved Supabase session pooler | PASS, IPv4 |
| HTTPS: api.supabase.com | PASS transport, HTTP 404 |
| HTTPS: api.vercel.com | PASS transport, HTTP 308 |
| HTTPS: docked.com.au | PASS transport, HTTP 200 |
| Direct Supabase DB TCP 5432 | PASS |
| Saved session pooler TCP 5432 | PASS |
| Git writes / database authentication / production build | Not tested |

The agent subsequently read the current command environment without retrying network or protected-file probes: it still reports `CODEX_PERMISSION_PROFILE=:workspace` and `CODEX_SANDBOX_NETWORK_DISABLED=1`. Existing tracked-change count remains 81. No full-access fix has reached this runtime.

This rules out a host-wide DNS outage, unavailable direct IPv6 transport, and a host-wide inability to create the tested junction/build directories at the time of comparison. It does not prove that every existing build output is unlocked, that Git is writable from the host, or that the pooler credentials/assignment are correct. The known-good Windows transport does not justify changing DNS servers, endpoints, security software, ACLs or database credentials.

Host success would isolate these failures to the Codex execution context, but would still not prove a software defect. Host failure would supply a specific DNS/TCP/junction error for a Windows/network investigation. HTTP 401/403/404 still proves successful HTTPS transport; it is not a connector-authentication test. Direct DB failure with pooler success can reflect IPv6 availability rather than total network failure.

Support/admin should inspect **effective app-server permission provenance** for this chat and the current local executor: which requirement, startup override, default permission profile or product execution context selects `:workspace` despite the saved legacy Full access setting? If an administrator constraint exists, only the authorized administrator should change it. If none exists, investigate the desktop-to-app-server configuration/default resolution. Do not repeat Full access/restart as a purported fix without this additional evidence.

Official documentation describes `/debug-config` for config layers and managed provenance, and `/status` for effective configuration. These are diagnostic controls, not a reason to run a replacement unrestricted agent. No claim is made that this desktop composer exposes either command.

- https://learn.chatgpt.com/docs/developer-settings
- https://learn.chatgpt.com/docs/permissions
- https://learn.chatgpt.com/docs/windows/windows-sandbox

## Rollout preservation

HEAD remains `8a137f680f01edce6151c20374c9e541346f0e6b`; all existing uncommitted work, snapshots, local databases and credentials were preserved. This investigation adds only diagnostic artifacts. No new deployed commit; live import/removal counts for this rollout remain **0 / 0**. Completion on docked.com.au is not claimed. After a supported fix, verify permissions once, complete the production build and refresh recovery fingerprints before resuming the authorized rollout.
