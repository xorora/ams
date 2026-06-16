export const DEFAULT_PAGE_SIZE = 25;

export const PAGE_SIZE_OPTIONS = [10, 25, 50, 100] as const;

export function getPageCount(totalItems: number, pageSize: number): number {
  return Math.max(1, Math.ceil(totalItems / pageSize));
}

export function clampPage(page: number, pageCount: number): number {
  return Math.min(Math.max(1, page), pageCount);
}

export function paginateItems<T>(items: T[], page: number, pageSize: number): T[] {
  const pageCount = getPageCount(items.length, pageSize);
  const safePage = clampPage(page, pageCount);
  const start = (safePage - 1) * pageSize;
  return items.slice(start, start + pageSize);
}

export function getPaginationRange(
  page: number,
  pageSize: number,
  totalItems: number,
): { start: number; end: number } {
  if (totalItems === 0) {
    return { start: 0, end: 0 };
  }

  const start = (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, totalItems);
  return { start, end };
}
