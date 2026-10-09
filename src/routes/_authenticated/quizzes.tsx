import { t } from "@/lib/i18n/core";
import { createFileRoute } from "@tanstack/react-router";
import { CommunityPage } from "@/components/site/CommunityPages";

export const Route = createFileRoute("/_authenticated/quizzes")({
  head: () => ({
    meta: [
      { title: t("المسابقات والامتحانات — أسرة افا باخوم") },
      { name: "description", content: t("مسابقات وامتحانات أسرة افا باخوم والمحاولات والنتائج.") },
      { property: "og:title", content: t("المسابقات والامتحانات — أسرة افا باخوم") },
      {
        property: "og:description",
        content: t("المشاركة في مسابقات الخدمة وامتحاناتها حسب المواعيد والصلاحيات."),
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: QuizzesPage,
});
function QuizzesPage() {
  const { user } = Route.useRouteContext();
  return <CommunityPage kind="quizzes" userId={user.id} />;
}
