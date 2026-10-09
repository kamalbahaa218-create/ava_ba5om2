import { AccessDenied, Loading } from "./AccessDenied";
import { SectionHeading } from "./SectionHeading";
import { ContentManager } from "./ContentManager";
import {
  QuizManager,
  StudentQuizzes,
  StudentContent,
  StudentSuggestions,
  SuggestionsManager,
} from "./part5";
import { useMyPermissions, useMyProfile } from "@/lib/auth";

export function CommunityPage({
  kind,
  userId,
}: {
  kind: "quizzes" | "content" | "suggestions";
  userId: string;
}) {
  const profile = useMyProfile(userId);
  const permissions = useMyPermissions(userId);
  if (profile.isLoading || permissions.isLoading) return <Loading />;
  if (!profile.data || !profile.data.is_active) return <AccessDenied />;
  const student = profile.data.user_type === "STUDENT";
  const can = (permission: string) =>
    profile.data?.user_type === "MAIN_ADMIN" ||
    !!permissions.data?.some((p) => p.name === permission);
  const title =
    kind === "quizzes"
      ? "المسابقات والامتحانات"
      : kind === "content"
        ? "الدروس والمحتوى"
        : "الاقتراحات والأسئلة";
  return (
    <section className="animate-rise">
      <SectionHeading title={title} />
      {kind === "quizzes" &&
        (student ? (
          <StudentQuizzes userId={userId} />
        ) : can("manage_quizzes") ? (
          <QuizManager userId={userId} />
        ) : (
          <AccessDenied />
        ))}
      {kind === "content" && (
        <>
          <StudentContent />
          {can("manage_lessons") && (
            <div className="mt-10">
              <ContentManager kind="content" userId={userId} userName={profile.data.full_name} />
            </div>
          )}
        </>
      )}
      {kind === "suggestions" &&
        (student ? (
          <StudentSuggestions userId={userId} />
        ) : can("manage_suggestions") ? (
          <SuggestionsManager />
        ) : (
          <AccessDenied />
        ))}
    </section>
  );
}
