import { loadJson } from '../data-reader.js';

interface ImportEdge {
  from: string;
  to: string;
  toRaw: string;
  symbols: string[];
  isExternal: boolean;
}

interface FunctionDecl {
  file: string;
  name: string;
  kind: string;
  line: number;
  endLine: number;
  params: string[];
  isExported: boolean;
}

interface StructureData {
  imports: ImportEdge[];
  functions: FunctionDecl[];
}

interface StructureParams {
  file: string;
  filename?: string;
}

interface StructureResult {
  file: string;
  functions: Omit<FunctionDecl, 'file'>[];
  imports: { from: string; to: string }[];
  importedBy: { from: string; to: string }[];
}

export async function handleStructure(
  dataDir: string,
  params: StructureParams,
): Promise<StructureResult> {
  const data = await loadJson<StructureData>(dataDir, params.filename ?? 'test-repo-structure.json');

  const functions = data.functions
    .filter((fn) => fn.file === params.file)
    .map(({ file: _file, ...rest }) => rest);

  const imports = data.imports.filter((edge) => edge.from === params.file);
  const importedBy = data.imports.filter((edge) => edge.to === params.file);

  return {
    file: params.file,
    functions,
    imports,
    importedBy,
  };
}
