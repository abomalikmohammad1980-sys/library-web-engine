import { pathToFileURL } from "node:url";
import { createWordPageMapHttpServer, WordMapServiceError, WordPageMapService } from "./word-page-map-service.js";

export function startWordPageMapFromEnv(env: NodeJS.ProcessEnv = process.env) {
  const port = Number(env.KHIZANA_WORD_MAP_PORT);
  const authToken = env.KHIZANA_WORD_MAP_TOKEN ?? "";
  const scriptPath = env.KHIZANA_WORD_MAP_SCRIPT ?? "";
  if (!scriptPath || !Number.isInteger(port) || port < 1 || port > 65535 || authToken.length < 32)
    throw new WordMapServiceError("invalid_request", 400);
  const timeoutMs = Number(env.KHIZANA_WORD_MAP_TIMEOUT_MS);
  const maxPartBytes = Number(env.KHIZANA_WORD_MAP_MAX_PART_BYTES);
  const maxTotalBytes = Number(env.KHIZANA_WORD_MAP_MAX_TOTAL_BYTES);
  const maxParts = Number(env.KHIZANA_WORD_MAP_MAX_PARTS);
  const tempRoot = env.KHIZANA_WORD_MAP_TEMP_ROOT;
  const service = new WordPageMapService({
    scriptPath,
    ...(timeoutMs > 0 ? { timeoutMs } : {}),
    ...(maxPartBytes > 0 ? { maxPartBytes } : {}),
    ...(maxTotalBytes > 0 ? { maxTotalBytes } : {}),
    ...(maxParts > 0 ? { maxParts } : {}),
    ...(tempRoot ? { tempRoot } : {})
  });
  return createWordPageMapHttpServer({ port, host: env.KHIZANA_WORD_MAP_HOST || "127.0.0.1", authToken, service });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const server = startWordPageMapFromEnv();
    const stop = () => server.close(() => process.exit(0));
    process.once("SIGINT", stop); process.once("SIGTERM", stop);
  } catch (error) {
    process.stderr.write(`${error instanceof WordMapServiceError ? error.code : "startup_failed"}\n`);
    process.exitCode = 1;
  }
}
