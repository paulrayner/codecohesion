import * as fs from 'fs';

export interface FileReader {
  stat(path: string): { size: number };
  readText(path: string): string;
}

export const nodeFileReader: FileReader = {
  stat: (filePath: string) => fs.statSync(filePath),
  readText: (filePath: string) => fs.readFileSync(filePath, 'utf-8'),
};
