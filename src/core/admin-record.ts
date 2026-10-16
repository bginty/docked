import {
  permittedSearchCategories,
  type AdminSearchCategory,
} from "./admin-navigation";

export type AdminRecord = {
  id: string;
  category: AdminSearchCategory;
  title: string;
  source: string;
  fields: Record<string, string | number | boolean | null>;
  history: { id: string; at: string | null; event: string; detail: string }[];
  page: number;
  hasMore: boolean;
};

export function adminRecordInput(
  input: Record<string, string | undefined>,
  role: string,
) {
  const category = input.category as AdminSearchCategory;
  if (!permittedSearchCategories(role).includes(category))
    throw Error("Category denied");
  const id = input.record ?? "";
  if (!id.trim() || id.length > 160 || /[\u0000-\u001f\u007f]/.test(id))
    throw Error("Invalid record");
  const page = Number(input.historyPage ?? "1");
  if (!Number.isInteger(page) || page < 1 || page > 100)
    throw Error("Invalid record page");
  return { category, id, page };
}
