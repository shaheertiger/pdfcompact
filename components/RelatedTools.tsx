import Link from "next/link";
import ToolIcon from "@/components/ToolIcon";
import { getRelatedTools } from "@/lib/tools";

export default function RelatedTools({ slug }: { slug: string }) {
  const related = getRelatedTools(slug, 4);
  if (related.length === 0) return null;

  return (
    <section className="mt-14">
      <h2 className="text-xl font-semibold mb-1">Related tools</h2>
      <p className="text-sm text-zinc-500 mb-4">
        PDFCompact can also help with these:
      </p>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {related.map((tool) => (
          <Link
            key={tool.slug}
            href={`/tools/${tool.slug}`}
            className="rounded-xl border border-black/10 dark:border-white/10 p-4 hover:border-red-400 hover:shadow-sm transition-all bg-white dark:bg-zinc-900"
          >
            <ToolIcon name={tool.icon} className="h-5 w-5 mb-2 text-red-600" />
            <div className="font-medium text-sm">{tool.name}</div>
          </Link>
        ))}
      </div>
    </section>
  );
}
