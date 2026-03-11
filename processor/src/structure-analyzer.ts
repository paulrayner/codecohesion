/**
 * StructureAnalyzer — static structure extraction from TypeScript/JavaScript files.
 *
 * Extracts ImportEdge and FunctionDecl entries from source files by walking the
 * tree-sitter AST. Syntax-error files are skipped with a warning. Relative imports
 * are resolved to repo-relative paths; bare specifiers are marked external.
 *
 * Constructor pattern mirrors RepositoryAnalyzer: (repoPath, logger?).
 * Files are processed in batches of 10.
 */

import * as fs from 'fs';
import * as path from 'path';
import Parser from 'tree-sitter';
// @ts-expect-error — tree-sitter-typescript has no bundled type declarations
import { typescript as TypeScriptLanguage } from 'tree-sitter-typescript';

import { StructureGraph, ImportEdge, FunctionDecl } from './structure-types';
import { Logger, consoleLogger } from './logger';

const BATCH_SIZE = 10;
const SOURCE_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx'];

/** Recursively walk a directory and return all matching source file paths. */
function collectSourceFiles(dir: string): string[] {
  const results: string[] = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...collectSourceFiles(fullPath));
    } else if (SOURCE_EXTENSIONS.includes(path.extname(entry.name))) {
      results.push(fullPath);
    }
  }
  return results;
}

/** Return true if the import specifier refers to an external package. */
function isExternalSpecifier(specifier: string): boolean {
  return !specifier.startsWith('.') && !specifier.startsWith('/');
}

/** Resolve a relative specifier to a repo-relative path (with .ts extension). */
function resolveRelative(
  fromFile: string,
  specifier: string,
  repoPath: string,
): string {
  const fromDir = path.dirname(fromFile);
  const resolved = path.resolve(fromDir, specifier);

  // Try adding .ts, .tsx, .js, .jsx extensions
  for (const ext of SOURCE_EXTENSIONS) {
    const candidate = resolved + ext;
    if (fs.existsSync(candidate)) {
      return path.relative(repoPath, candidate);
    }
  }

  // Fall back to specifier + .ts if nothing matches
  return path.relative(repoPath, resolved + '.ts');
}

/** Extract parameter names from a formal_parameters or parameter list node. */
function extractParamNames(paramsNode: Parser.SyntaxNode | null): string[] {
  if (!paramsNode) return [];
  const names: string[] = [];
  for (const child of paramsNode.namedChildren) {
    // required_parameter, optional_parameter, rest_parameter
    const identNode = child.childForFieldName('pattern') ?? child.childForFieldName('name');
    if (identNode && identNode.type === 'identifier') {
      names.push(identNode.text);
    } else if (child.type === 'identifier') {
      names.push(child.text);
    }
  }
  return names;
}

/** Check if a node's parent is an export_statement. */
function hasExportModifier(node: Parser.SyntaxNode): boolean {
  return node.parent !== null && node.parent.type === 'export_statement';
}

/** Parse imports from a tree-sitter root node. */
function extractImports(
  rootNode: Parser.SyntaxNode,
  fromFile: string,
  repoPath: string,
): ImportEdge[] {
  const imports: ImportEdge[] = [];

  for (const node of rootNode.namedChildren) {
    if (node.type !== 'import_statement') continue;

    // Get the string specifier node
    const sourceNode = node.childForFieldName('source');
    if (!sourceNode) continue;

    // Remove surrounding quotes
    const raw = sourceNode.text.replace(/^['"]|['"]$/g, '');

    // Collect named symbols from import clause
    const symbols: string[] = [];
    const importClause = node.childForFieldName('import_clause') ?? node.namedChildren.find(c => c.type === 'import_clause');
    if (importClause) {
      // Look for named imports: import { a, b }
      const namedImports = importClause.namedChildren.find(c => c.type === 'named_imports');
      if (namedImports) {
        for (const spec of namedImports.namedChildren) {
          if (spec.type === 'import_specifier') {
            const nameNode = spec.childForFieldName('name') ?? spec.namedChildren[0];
            if (nameNode) symbols.push(nameNode.text);
          }
        }
      }
    }

    const external = isExternalSpecifier(raw);
    const to = external ? '' : resolveRelative(fromFile, raw, repoPath);
    const repoRelativeFrom = path.relative(repoPath, fromFile);

    imports.push({
      from: repoRelativeFrom,
      to,
      toRaw: raw,
      symbols,
      isExternal: external,
    });
  }

  return imports;
}

/** Walk an AST node and collect all function/method/arrow/class declarations. */
function extractFunctions(
  rootNode: Parser.SyntaxNode,
  fromFile: string,
  repoPath: string,
): FunctionDecl[] {
  const functions: FunctionDecl[] = [];
  const repoRelativeFile = path.relative(repoPath, fromFile);

  function visit(node: Parser.SyntaxNode): void {
    switch (node.type) {
      case 'function_declaration': {
        const nameNode = node.childForFieldName('name');
        const paramsNode = node.childForFieldName('parameters');
        if (nameNode) {
          functions.push({
            file: repoRelativeFile,
            name: nameNode.text,
            kind: 'function',
            line: node.startPosition.row + 1,
            endLine: node.endPosition.row + 1,
            params: extractParamNames(paramsNode),
            isExported: hasExportModifier(node),
          });
        }
        break;
      }
      case 'lexical_declaration': {
        // Handle: const foo = (x) => ...  or  const foo = function() {}
        for (const declarator of node.namedChildren) {
          if (declarator.type !== 'variable_declarator') continue;
          const nameNode = declarator.childForFieldName('name');
          const valueNode = declarator.childForFieldName('value');
          if (!nameNode || !valueNode) continue;
          if (valueNode.type === 'arrow_function') {
            const paramsNode = valueNode.childForFieldName('parameters') ?? valueNode.namedChildren.find(c => c.type === 'formal_parameters');
            functions.push({
              file: repoRelativeFile,
              name: nameNode.text,
              kind: 'arrow',
              line: declarator.startPosition.row + 1,
              endLine: declarator.endPosition.row + 1,
              params: extractParamNames(paramsNode ?? null),
              isExported: hasExportModifier(node),
            });
          }
        }
        break;
      }
      case 'class_declaration': {
        const nameNode = node.childForFieldName('name');
        if (nameNode) {
          functions.push({
            file: repoRelativeFile,
            name: nameNode.text,
            kind: 'class',
            line: node.startPosition.row + 1,
            endLine: node.endPosition.row + 1,
            params: [],
            isExported: hasExportModifier(node),
          });
        }
        // Extract methods from the class body
        const bodyNode = node.childForFieldName('body');
        if (bodyNode) {
          for (const member of bodyNode.namedChildren) {
            if (member.type === 'method_definition') {
              const methodNameNode = member.childForFieldName('name');
              const paramsNode = member.childForFieldName('parameters');
              if (methodNameNode) {
                const methodName = methodNameNode.text;
                const isConstructor = methodName === 'constructor';
                functions.push({
                  file: repoRelativeFile,
                  name: methodName,
                  kind: isConstructor ? 'constructor' : 'method',
                  line: member.startPosition.row + 1,
                  endLine: member.endPosition.row + 1,
                  params: extractParamNames(paramsNode),
                  isExported: false,
                });
              }
            }
          }
        }
        // Skip recursing into class body — already handled above
        return;
      }
    }

    for (const child of node.namedChildren) {
      visit(child);
    }
  }

  visit(rootNode);
  return functions;
}

export class StructureAnalyzer {
  private readonly repoPath: string;
  private readonly logger: Logger;

  constructor(repoPath: string, logger: Logger = consoleLogger) {
    this.repoPath = repoPath;
    this.logger = logger;
  }

  async analyze(): Promise<StructureGraph> {
    const parser = new Parser();
    parser.setLanguage(TypeScriptLanguage);

    const allFiles = collectSourceFiles(this.repoPath);
    this.logger.log(`StructureAnalyzer: found ${allFiles.length} source files`);

    const allImports: ImportEdge[] = [];
    const allFunctions: FunctionDecl[] = [];
    let parseErrors = 0;

    // Process in batches of BATCH_SIZE
    for (let batchStart = 0; batchStart < allFiles.length; batchStart += BATCH_SIZE) {
      const batch = allFiles.slice(batchStart, batchStart + BATCH_SIZE);
      for (const filePath of batch) {
        let source: string;
        let tree: ReturnType<typeof parser.parse>;
        try {
          source = fs.readFileSync(filePath, 'utf8');
          tree = parser.parse(source);
        } catch (err) {
          this.logger.warn(`StructureAnalyzer: error reading ${filePath}: ${err}`);
          parseErrors++;
          continue;
        }

        if (tree.rootNode.hasError) {
          this.logger.warn(`StructureAnalyzer: parse error in ${filePath}, skipping`);
          parseErrors++;
          continue;
        }

        allImports.push(...extractImports(tree.rootNode, filePath, this.repoPath));
        allFunctions.push(...extractFunctions(tree.rootNode, filePath, this.repoPath));
      }
    }

    return {
      format: 'structure-v1',
      repositoryPath: this.repoPath,
      analyzedAt: new Date().toISOString(),
      analysis: {
        filesAnalyzed: allFiles.length - parseErrors,
        importEdges: allImports.length,
        functionDecls: allFunctions.length,
        parseErrors,
      },
      imports: allImports,
      functions: allFunctions,
    };
  }
}
