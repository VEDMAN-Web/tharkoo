/**
 * Runs `worker` over `items` with at most `limit` running at once. Results keep the input order.
 * The worker must not throw; report failures through its own state.
 */
export async function runLimited<T>(items: readonly T[], limit: number, worker: (item: T, index: number) => Promise<void>): Promise<void> {
  const slots = Math.max(1, Math.floor(limit));
  let next = 0;
  const lane = async () => {
    while (next < items.length) {
      const index = next;
      next += 1;
      await worker(items[index], index);
    }
  };
  await Promise.all(Array.from({ length: Math.min(slots, items.length) }, () => lane()));
}
