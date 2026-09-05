import { PageMeta, PageParams } from "../types/common";
import { AppError } from "../errors/AppError";

const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 200;

type Options = {
  sortable: string[];
  defaultSort: string;
  defaultOrder?: "asc" | "desc";
};

/**
 * Parses `page`/`limit`/`sort`/`order`/`q` (BR-X-2). `sort` is validated against an
 * allow-list because it is interpolated into an ORDER BY, where a parameter cannot go.
 */
export function parsePageParams(
  query: Record<string, unknown>,
  options: Options,
): PageParams {
  const page = toPositiveInt(query.page, 1, "page");
  const limit = Math.min(toPositiveInt(query.limit, DEFAULT_LIMIT, "limit"), MAX_LIMIT);
  const sort = query.sort === undefined ? options.defaultSort : String(query.sort);

  if (!options.sortable.includes(sort)) {
    throw new AppError(
      400,
      `Cannot sort by "${sort}".`,
      "validation_error",
      [{ field: "sort", message: `must be one of: ${options.sortable.join(", ")}` }],
    );
  }

  const rawOrder = query.order === undefined ? (options.defaultOrder ?? "asc") : String(query.order);

  if (rawOrder !== "asc" && rawOrder !== "desc") {
    throw new AppError(400, `Cannot order by "${rawOrder}".`, "validation_error", [
      { field: "order", message: "must be asc or desc" },
    ]);
  }

  const q = typeof query.q === "string" && query.q.trim() !== "" ? query.q.trim() : undefined;

  return { page, limit, offset: (page - 1) * limit, sort, order: rawOrder, q };
}

export function buildPageMeta(params: PageParams, total: number): PageMeta {
  return {
    page: params.page,
    limit: params.limit,
    total,
    total_pages: total === 0 ? 0 : Math.ceil(total / params.limit),
  };
}

function toPositiveInt(value: unknown, fallback: number, field: string): number {
  if (value === undefined || value === "") {
    return fallback;
  }

  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new AppError(400, `Invalid ${field}.`, "validation_error", [
      { field, message: "must be a positive integer" },
    ]);
  }

  return parsed;
}
