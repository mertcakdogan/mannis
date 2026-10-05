# Provider integration verification — 2026-10-05

## Implemented
- Windows chat routes Anthropic, OpenCode and 9router through the existing IPC.
- OpenCode sessions deny all tools and require the server to echo that policy.
- Provider URLs, model IDs and authentication stay in the Rust HTTP boundary.
- Credentials stay in the OS credential store; settings JSON has no key fields.
- Models auto-load after credential save/Enter and opening a provider with saved
  credentials. Native dropdown selection supports a custom model/alias/ combo.
- Conversation history resets on connection changes; late replies after reset
  are discarded. Failed provider turns do not enter accepted history.
- Windows CI now checks types, frontend tests and Rust workspace tests on PRs.

## Verification
- npm run build: PASS (hook resource, TypeScript and production Vite bundle).
- cargo build --locked -p mannis: PASS on Windows MSVC.
- Rust workspace: 33 passed; live smoke intentionally ignored by default.
- bun test tests: 8 passed, including model IDs, history identity and custom alias.
- Opt-in live adapter smoke: PASS with local 9router and oc/space-bunny-free.
- Separate live HTTP request returned MANNIS_OK; discovery advertised
  ocg/space-bunny-free while accepting the requested oc/ alias.
- Actual OpenCode 1.18.32: provider listing and deny-all session policy confirmed.
  No model prompts or paid requests were sent through that server during this QA.
- Browser real DOM: key save and Enter each loaded models; dropdown selection
  persisted the selected ID; saved-key reopen loaded automatically; custom alias
  survived refresh; loading, empty, connection error and save error were exercised.
- Responsive evidence: 375,460,560,768,1280px x three providers; no horizontal
  overflow. 22 final JPEG captures in .qa/automatic-models/ with valid signatures.
  Development harness fixtures are explicitly labelled and excluded from build.
- Review: provider_ui_integrity and provider_ui_visual initial and supplemental
  passes approved. Final automatic discovery integrity: PASS. Visual review
  final visual review: PASS after loading capture repair. Both independent
  reviewers approved the current22-state evidence set. Corrected live viewport
  frame saved as loading.jpg (loading-verified.jpg is an identical diagnostic copy).

## Architecture check
New modules separate transport, provider wire schemas, conversation state,
file context and settings form. Remote JSON is deserialized into typed values.
Provider dispatch matches all enum variants. New production modules contain no
untyped escape hatches or unchecked unwraps. New modules remain under 250 lines
of substantive code; legacy wiring files receive only focused edits.

## Limits and pre-existing observations
Strict Clippy fails on three pre-existing diagnostics in hooks.rs:489
(needless_range_loop) and island.rs:217,223 (manual_is_multiple_of,
unnecessary_to_owned). New modules add no Clippy findings; a separate diagnostic
run with only these existing categories exempted passes. No lint suppression was
added to project source or CI.

Native GUI clicks, Windows Credential Manager persistence, MSI installation,
multi-monitor/DPI, sleep/resume and full Windows10/11 desktop compatibility have
not been exercised end-to-end. Browser UI and live Rust adapter were checked
separately because native UI automation is unavailable in this session.
OpenCode CLI session monitoring and permission cards are not part of this chat
connection increment. Character/icon/branding decisions remain for later.

No keys, passwords or upstream credential fields are included in this record.

Capture pipeline observation: full-page capture returned a stale narrow frame
while a fixture HTTP promise was pending. Live viewport capture fixed it; original
image detail confirms the centered672px card and disabled controls. No product
CSS or implementation change was needed for that capture repair.

Final reviewers: /root/provider_ui_integrity PASS; /root/provider_ui_visual PASS.
The loading DOM selector counter was unreliable in the browser read-only scope;
it is not a formal test assertion. Disabled controls were verified in the browser
accessibility state, source and corrected live screenshot instead.
