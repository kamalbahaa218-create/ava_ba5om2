# Requested updates
- [x] Move quizzes, content and suggestions into separate navigation pages; remove dashboard duplicates.
- [x] Show two latest history entries with full-history expansion.
- [x] Synchronize journey checkpoints with scheduled times.
- [x] Preserve managed internal privileged access for account creation, disabling and deletion without requesting a manually supplied key: source inspection found no manual key configuration outside the generated Cloud integration. Keep that integration unchanged; its internal environment-variable read is not a user setup requirement. Account operations were not executed during this review.
- [x] Add respectful attendance welcome animation before confirmation.
- [x] Verify requested flows and permission/time rules: 8 tests pass; signed-in admin pages/navigation checked; histories and clock transitions checked with intercepted fixture reads; animation checked with simulated RPC success (no attendance record written); build OK.