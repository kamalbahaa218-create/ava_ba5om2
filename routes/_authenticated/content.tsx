import { t } from "@/lib/i18n/core";
import { createFileRoute } from "@tanstack/react-router";
import { CommunityPage } from "@/components/site/CommunityPages";

export const Route = createFileRoute("/_authenticated/content")({
  head: () => ({
    meta: [
      { title: t("الدروس والمحتوى — أسرة افا باخوم") },
      { name: "description", content: t("دروس ومراجع ومحتوى خدمة أسرة افا باخوم.") },
      { property: "og:title", content: t("الدروس والمحتوى — أسرة افا باخوم") },
      {
        property: "og:description",
        content: t("الدروس والمراجع والمحتوى المتاح لأعضاء الخدمة حسب صلاحياتهم."),
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ContentPage,
});
function ContentPage() {
  const { user } = Route.useRouteContext();
  return <CommunityPage kind="content" userId={user.id} />;
}
