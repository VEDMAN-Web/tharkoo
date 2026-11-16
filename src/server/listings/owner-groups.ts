/**
 * H6.19: the groups behind the vendor panel tabs. "All" is no filter at all.
 * Live = published now, In review = waiting for our checks, Ended = past its run or archived.
 */
export const OWNER_GROUPS = ["live", "review", "ended"] as const;
export type OwnerGroup = (typeof OWNER_GROUPS)[number];

export const DELETED_STATUSES = ["removed", "deleted"] as const;

const GROUP_STATUSES: Record<OwnerGroup, readonly string[]> = {
  live: ["active"],
  review: ["pending"],
  ended: ["expired", "archived"],
};

export function ownerGroupStatuses(group: OwnerGroup): string[] {
  return [...GROUP_STATUSES[group]];
}

/** The Mongo filter for one owner's ads. A group wins over a single status. */
export function ownerFilter(userId: string, query: { status?: string; group?: OwnerGroup }): Record<string, unknown> {
  const filter: Record<string, unknown> = { ownerId: userId, status: { $nin: [...DELETED_STATUSES] } };
  if (query.group) filter.status = { $in: ownerGroupStatuses(query.group) };
  else if (query.status) filter.status = query.status;
  return filter;
}
