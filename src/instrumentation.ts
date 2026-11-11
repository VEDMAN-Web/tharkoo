export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const sharp = (await import("sharp")).default;
  sharp.concurrency(1);
  sharp.cache({ memory: 16, files: 0, items: 8 });
}
