import { t } from "@/lib/i18n/core";
import { createFileRoute, Navigate } from "@tanstack/react-router";
import { Loading } from "@/components/site/AccessDenied";
import { homePathFor, useMyProfile } from "@/lib/auth";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: t("لوحتي — أسرة افا باخوم") },
      { name: "description", content: t("صفحتك الشخصية في خدمة أسرة افا باخوم.") },
      { property: "og:title", content: t("لوحتي — أسرة افا باخوم") },
      { property: "og:description", content: t("صفحتك الشخصية في خدمة أسرة افا باخوم.") },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: DashboardRedirect,
});

function DashboardRedirect() {
  const { user } = Route.useRouteContext();
  const { data, isLoading } = useMyProfile(user.id);
  if (isLoading || !data) return <Loading />;
  return <Navigate to={homePathFor(data.user_type)} replace />;
}
