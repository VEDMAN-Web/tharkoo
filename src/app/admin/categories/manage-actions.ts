"use server";

import { getStaffFromHeaders } from "@/lib/admin-auth";
import { adminContext } from "@/server/admin/context";
import {
  createCategory,
  createSubcategory,
  deleteCategory,
  deleteSubcategory,
  reorder,
  changeCategoryKind,
  updateCategory,
  updateSubcategory,
  type CategoryInput,
  type SubcategoryInput,
} from "@/server/categories/manage";

export type ManageResult<T = unknown> = { ok: true; data: T } | { ok: false; message: string };

async function run<T>(work: (actor: { email: string; roles: string[] }) => Promise<T>): Promise<ManageResult<T>> {
  try {
    const who = await getStaffFromHeaders();
    return { ok: true, data: await work({ email: who.email, roles: who.roles }) };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "Save failed" };
  }
}

export async function createCategoryAction(input: CategoryInput) {
  return run((actor) => createCategory(actor, input));
}
export async function updateCategoryAction(id: string, input: CategoryInput) {
  return run(async (actor) => {
    const { kind, confirmPeopleOff, ...rest } = input;
    let kindEventId = "";
    if (kind !== undefined) {
      const changed = await changeCategoryKind(await adminContext(), id, kind, { confirmPeopleOff });
      kindEventId = changed.eventId;
    }
    const done = await updateCategory(actor, id, rest);
    return { ...done, kindEventId };
  });
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
