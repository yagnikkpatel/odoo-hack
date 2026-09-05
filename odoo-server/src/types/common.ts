export type PageMeta = {
  page: number;
  limit: number;
  total: number;
  total_pages: number;
};

export type PageParams = {
  page: number;
  limit: number;
  offset: number;
  sort: string;
  order: "asc" | "desc";
  q?: string;
};

export type Paginated<T> = {
  rows: T[];
  meta: PageMeta;
};
