/** Legacy photo rewrite. Listings no longer store a photos array; this entry is a no-op. */
async function main() {
  console.log("photos_patched 0");
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : "patch failed");
  process.exit(1);
});
