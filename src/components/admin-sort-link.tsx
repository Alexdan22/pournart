import Link from "next/link";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";

type SortParams = Record<string, string | undefined>;

export function AdminSortLink({
  basePath,
  label,
  searchParams,
  sortKey,
  defaultSort = "updated",
}: {
  basePath: string;
  label: string;
  searchParams: SortParams;
  sortKey: string;
  defaultSort?: string;
}) {
  const currentSort = searchParams.sort || defaultSort;
  const currentDirection = searchParams.direction === "asc" ? "asc" : "desc";
  const active = currentSort === sortKey;
  const nextDirection = active && currentDirection === "asc" ? "desc" : "asc";
  const params = new URLSearchParams();
  const Icon = active ? (currentDirection === "asc" ? ArrowUp : ArrowDown) : ArrowUpDown;

  for (const [key, value] of Object.entries(searchParams)) {
    if (value && key !== "page") {
      params.set(key, value);
    }
  }

  params.set("sort", sortKey);
  params.set("direction", nextDirection);

  return (
    <Link className={active ? "admin-sort-link active" : "admin-sort-link"} href={`${basePath}?${params.toString()}`}>
      <span>{label}</span>
      <Icon aria-hidden size={13} />
    </Link>
  );
}
