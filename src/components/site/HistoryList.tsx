import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { historyPreview } from "@/lib/activity";

export function HistoryList<T>({
  rows,
  render,
  className = "space-y-2",
  list = false,
}: {
  rows: readonly T[];
  render: (row: T) => ReactNode;
  className?: string;
  list?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const Tag = list ? "ul" : "div";
  return (
    <>
      <Tag className={className}>{historyPreview(rows, expanded).map(render)}</Tag>
      {rows.length > 2 && (
        <Button
          variant="link"
          className="mt-2 px-0 font-semibold"
          aria-expanded={expanded}
          onClick={() => setExpanded((value) => !value)}
        >
          {expanded ? "عرض أقل" : "عرض المزيد"}
        </Button>
      )}
    </>
  );
}
