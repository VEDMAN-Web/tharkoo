"use server";

import { getStaffFromHeaders } from "@/lib/admin-auth";
import {
  createCategory,
  createSubcategory,
  deleteCategory,
  deleteSubcategory,
  reorder,
  updateCategory,
  updateSubcategory,
  type CategoryInput,
  type SubcategoryInput,
} from "@/server/categories/manage";

export type ManageResult = { ok: true } | { ok: false; message: string };

async function run(work: (actor: { email: string; roles: string[] }) => Promise<unknown>): Promise<ManageResult> {
  try {
    const who = await getStaffFromHeaders();
    await work({ email: who.email, roles: who.roles });
    return { ok: true };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "Save failed" };
  }
}

export async function createCategoryAction(input: CategoryInput) {
  return run((actor) => createCategory(actor, input));
}
export async function updateCategoryAction(id: string, input: CategoryInput) {
  return run((actor) => updateCategory(actor, id, input));
}
export async function deleteCategoryAction(id: string) {
  return run((actor) => deleteCategory(actor, id));
}
export async function createSubcategoryAction(input: SubcategoryInput) {
  return run((actor) => createSubcategory(actor, input));
}
export async function updateSubcategoryAction(id: string, input: SubcategoryInput) {
  return run((actor) => updateSubcategory(actor, id, input));
}
export async function deleteSubcategoryAction(id: string) {
  return run((actor) => deleteSubcategory(actor, id));
}
export async function reorderAction(kind: "category" | "subcategory", ids: string[]) {
  return run((actor) => reorder(actor, kind, ids));
}
