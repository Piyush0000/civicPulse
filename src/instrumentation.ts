export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { boot } = await import("./lib/boot");
  // Do not block server start: seeding runs in the background and the UI shows its progress.
  void boot();
}
