import * as fs from 'fs';
import * as path from 'path';

/**
 * Reads and parses a JSON file from the given data directory.
 *
 * Throws a descriptive error when the file is missing, unreadable, or contains
 * invalid JSON so callers can surface actionable messages to the MCP client
 * rather than receiving an opaque crash.
 */
export async function loadJson<T>(dataDir: string, filename: string): Promise<T> {
  const filePath = path.join(dataDir, filename);

  let rawContent: string;
  try {
    rawContent = await fs.promises.readFile(filePath, 'utf-8');
  } catch (error: unknown) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      throw new Error(`Data file not found: ${filePath}`);
    }
    if ((error as NodeJS.ErrnoException).code === 'EACCES') {
      throw new Error(`Permission denied reading data file: ${filePath}`);
    }
    throw new Error(
      `Failed to read data file: ${filePath} — ${(error as Error).message}`,
    );
  }

  try {
    return JSON.parse(rawContent) as T;
  } catch (error: unknown) {
    throw new Error(
      `Invalid JSON in data file: ${filePath} — ${(error as Error).message}`,
    );
  }
}
