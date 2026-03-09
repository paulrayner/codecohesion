import * as fs from 'fs/promises';

export async function loadJson(filePath: string): Promise<unknown> {
  let raw: string;
  try {
    raw = await fs.readFile(filePath, 'utf-8');
  } catch (err) {
    const nodeErr = err as NodeJS.ErrnoException;
    if (nodeErr.code === 'ENOENT') {
      throw new Error(`File not found: ${filePath}`);
    }
    if (nodeErr.code === 'EACCES') {
      throw new Error(`Permission denied reading file: ${filePath}`);
    }
    // Re-throw unexpected I/O errors with original info intact
    throw new Error(`Failed to read file: ${filePath} — ${nodeErr.message}`);
  }

  try {
    return JSON.parse(raw);
  } catch (err) {
    const parseErr = err as SyntaxError;
    throw new Error(`Invalid JSON in file: ${filePath} — ${parseErr.message}`);
  }
}
