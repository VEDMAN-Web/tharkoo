# PROGRESS

Index only. Ana updates this file when a PR merges. The coder updates `progress/<task-id>.md`.

| Task | Platform | Owner model | Status | Branch | PR | Depends | Blocker | Last update |
|---|---|---|---|---|---|---|---|---|
| T0.1 | Cur | C | merged | cursor/t0.1-ci-workflow | https://github.com/VEDMAN-Web/tharkoo/pull/1 | - | | 2026-11-10 |
| T0.2 | Cdx | M | merged | codex/t0.2-lint-types | https://github.com/VEDMAN-Web/tharkoo/pull/2 | - | | 2026-11-10 |
| T0.3 | Cur | M | merged | cursor/t0.3-build-harness | https://github.com/VEDMAN-Web/tharkoo/pull/3 | T0.2 | | 2026-11-10 |
| T0.4 | Cur | C | merged | codex/t0.4-purge-neutral | https://github.com/VEDMAN-Web/tharkoo/pull/5 | T0.2 | | 2026-11-10 |
| T0.5 | Cur | C | merged | cursor/t0.5-clear-leftovers | https://github.com/VEDMAN-Web/tharkoo/pull/7 | T0.4 | | 2026-11-10 |
| T1.1 | Cur | S | in progress | cursor/t1.1-data-model | | T0.3 | | 2026-11-10 |
| T1.2 | Cur | C | todo | cursor/t1.2-seed | | T1.1 | | 2026-11-09 |
| T2.1 | Cur | S | todo | cursor/t2.1-auth | | T1.1 | | 2026-11-09 |
| T2.2 | Cur | M | todo | cursor/t2.2-media | | T1.1, T2.1 | | 2026-11-09 |
| T2.3 | Cur | M | todo | cursor/t2.3-kyc | | T2.1, T2.2 | | 2026-11-09 |
| T2.4 | Cdx | M | todo | codex/t2.4-auth-ui | | T2.1, T2.3, T8.1 | | 2026-11-09 |
| T3.1 | Cur | M | todo | cursor/t3.1-listings | | T1.1, T2.1, T2.2, T2.3 | | 2026-11-09 |
| T3.2 | Cdx | M | todo | codex/t3.2-post-ui | | T3.1, T2.4, T8.1 | | 2026-11-09 |
| T4.1 | Cur | S | todo | cursor/t4.1-billing | | T3.1 | | 2026-11-09 |
| T4.2 | Cdx | M | todo | codex/t4.2-wallet-ui | | T4.1, T3.2, T8.1 | | 2026-11-09 |
| T5.1 | Cur | M | todo | cursor/t5.1-search | | T1.2, T3.1 | | 2026-11-09 |
| T5.2 | Cdx | M | todo | codex/t5.2-public-ui | | T5.1, T6.1, T8.1 | | 2026-11-09 |
| T6.1 | Cur | M | todo | cursor/t6.1-seo-engine | | T5.1 | | 2026-11-09 |
| T6.2 | Cur | C | todo | cursor/t6.2-seo-content | | T1.2, T6.1 | | 2026-11-09 |
| T7.1 | Cur | M | todo | cursor/t7.1-admin-api | | T2.1, T3.1, T4.1 | | 2026-11-09 |
| T7.2 | Cdx | M | todo | codex/t7.2-admin-ui | | T7.1, T2.4, T8.1 | | 2026-11-09 |
| T8.1 | Cdx | S | todo | codex/t8.1-design-system | | T0.4 | | 2026-11-09 |
| T9.1 | Cur | M | todo | cursor/t9.1-qa | | all feature tasks | | 2026-11-09 |
| T9.2 | Ana | S | todo | - | | T9.1 | | 2026-11-09 |
| T10.1 | Cur | C | todo | cursor/t10.1-bootstrap | | T9.1 | | 2026-11-09 |
| T10.2 | Cur | M | todo | cursor/t10.2-deploy | | T10.1 | | 2026-11-09 |
| T10.3 | Ana | - | todo | - | | T10.2 | | 2026-11-09 |
