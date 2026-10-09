import { t } from "@/lib/i18n/core";
import { createFileRoute } from "@tanstack/react-router";
import { CommunityPage } from "@/components/site/CommunityPages";

export const Route = createFileRoute("/_authenticated/suggestions")({
  head: () => ({
    meta: [
      { title: t("الاقتراحات والأسئلة — أسرة افا باخوم") },
      {
        name: "description",
        content: t("إرسال الاقتراحات والأسئلة ومتابعة حالتها في أسرة افا باخوم."),
      },
      { property: "og:title", content: t("الاقتراحات والأسئلة — أسرة افا باخوم") },
      { property: "og:description", content: t("اقتراحات وأسئلة أعضاء الخدمة ومتابعتها بخصوصية.") },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SuggestionsPage,
});
function SuggestionsPage() {
  const { user } = Route.useRouteContext();
  return <CommunityPage kind="suggestions" userId={user.id} />;
}
