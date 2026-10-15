export async function registerNode() {
  try {
    await import("./lib/env");
  } catch (error) {
    // After a failed register() Next keeps running and answers every request with a 500,
    // so stop the process instead: a bad config should be fixed before anything is served.
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }
}
