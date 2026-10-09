import { t } from "@/lib/i18n/core";
import { createFileRoute } from "@tanstack/react-router";
import { AccessDenied, Loading } from "@/components/site/AccessDenied";
import { SectionHeading } from "@/components/site/SectionHeading";
import { FollowupWorkspace } from "@/components/site/part6";
import { useMyPermissions, useMyProfile } from "@/lib/auth";

export const Route = createFileRoute("/_authenticated/followup")({
  head: () => ({
    meta: [
      { title: t("الافتقاد — أسرة افا باخوم") },
      { name: "description", content: t("افتقاد المخدومين وسجلات الحضور والغياب.") },
      { property: "og:title", content: t("الافتقاد — أسرة افا باخوم") },
      { property: "og:description", content: t("متابعة المخدومين وردودهم على رسائل الغياب.") },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: FollowupPage,
});
function FollowupPage() {
  const { user } = Route.useRouteContext();
  const profile = useMyProfile(user.id);
  const perms = useMyPermissions(user.id);
  if (profile.isLoading || perms.isLoading) return <Loading />;
  const t = profile.data?.user_type;
  if (!profile.data?.is_active || (t !== "SERVANT" && t !== "MAIN_ADMIN")) return <AccessDenied />;
  const has = (n: string) => !!perms.data?.some((p) => p.name === n);
  return (
    <section className="animate-rise">
      <SectionHeading title="الافتقاد" />
      <FollowupWorkspace
        userId={user.id}
        isAdmin={t === "MAIN_ADMIN"}
        canManage={has("manage_followup")}
        canPrivate={has("view_private_student_data")}
      />
    </section>
  );
}
