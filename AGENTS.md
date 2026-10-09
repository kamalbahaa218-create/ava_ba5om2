<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Arabic RTL app: shared page chrome and cards live in `src/components/site/`; all persistent content (topics, program, events, announcements, lessons, classes) is read from the database via hooks in `src/lib/content.ts` — no hardcoded data.
- Generic admin CRUD for content tables lives in `src/components/site/ContentManager.tsx` (config per table); writes are authorized by RLS using `has_permission`.
- Account disable/delete go through main-admin server functions in `src/lib/admin.functions.ts` (auth ban + `profiles.is_active`) — the client never calls the auth admin API.
- Attendance and leaderboard writes/reads go through SQL security-definer functions (record_attendance, get_leaderboard); QR holds only a random session token — students can never insert attendance directly.
- Quizzes, suggestions, private student data and student lessons UI live in `src/components/site/part5.tsx`; quiz answer keys sit in a manager-only table and grading/listing go through security-definer RPCs (get_quiz_questions, submit_quiz, list_suggestions, set_suggestion_status) so correct answers and anonymous authors never reach students or managers' raw queries.
- Dedicated protected community routes reuse the existing quiz, content and suggestion components; permission checks select views while RLS continues to authorize data access.
- History views use the shared HistoryList and paginated readFullHistory helper to avoid truncating full authorized records or changing points totals.
- Journey status derives from raw program date/time in Africa/Cairo; never parse localized display labels or simulate checkpoint progress.
- Attendance welcome mounts only after a successful attendance RPC; reduced motion and asset failures show confirmation immediately.
- Use the generated Cloud privileged server client inside authorized Auth Admin handlers; do not add manual credential configuration or replace it with direct writes to managed auth tables, because no supported keyless runtime substitute exists.

- New-content dots: tables call the `bump_section(key)` statement trigger; per-user seen state lives in `section_views`; nav paths map to keys in `src/lib/sections.ts`. Why: one reusable mechanism for any section.
- i18n: Arabic source text is the translation key; English lives in `src/lib/i18n/en.ts`. A custom JSX runtime (`jsxImportSource` in vite.config.ts) translates static JSX text and placeholder/title/aria-label/alt; use `t()` only for non-JSX sinks (toasts, head meta, templates with `{0}` params) and `loc()` for date/number locales. Language is a `lang` cookie read during SSR; switching reloads the page. Why: one app and one dataset for both languages, with minimal per-file changes; user content passes through untouched unless it exactly matches a UI string.
