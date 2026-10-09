# أسرة افا باخوم

نظام إدارة خدمة مدارس الأحد (ثانوي) — كنيسة السيدة العذراء مريم صانعة المعجزات بالأميرية.

## Development

```bash
bun install
bun run dev
```

Stack: TanStack Start (React), Tailwind CSS v4, PostgreSQL with row-level security.

## Managed account administration

Account creation, disabling and deletion use Lovable Cloud's generated privileged server integration. Do not add a manually supplied service-role key or an empty `SUPABASE_SERVICE_ROLE_KEY` placeholder. Internal credential handling stays in the generated server-only integration; authenticated admin handlers verify main-admin permission before account operations. Ordinary user data access continues to use the existing RLS policies.
