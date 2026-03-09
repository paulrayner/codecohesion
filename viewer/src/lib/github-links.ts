/**
 * GitHub repository URL mapping and URL-building utilities.
 *
 * All exports are pure — no DOM access. DOM updates (e.g. updateRepoGitHubLink)
 * remain in main.ts.
 */

interface GitHubRepoInfo {
  owner: string;
  repo: string;
  url: string;
}

/** Known repository → GitHub coordinates mapping. */
export const REPO_GITHUB_URLS: Record<string, GitHubRepoInfo> = {
  'gource': { owner: 'acaudwell', repo: 'Gource', url: 'https://github.com/acaudwell/Gource' },
  'cbioportal': { owner: 'cBioPortal', repo: 'cbioportal', url: 'https://github.com/cBioPortal/cbioportal' },
  'cbioportal-frontend': { owner: 'cBioPortal', repo: 'cbioportal-frontend', url: 'https://github.com/cBioPortal/cbioportal-frontend' },
  'react': { owner: 'facebook', repo: 'react', url: 'https://github.com/facebook/react' },
  'codecohesion': { owner: 'paulrayner', repo: 'codecohesion', url: 'https://github.com/paulrayner/codecohesion' },
};

/**
 * Return the GitHub coordinates for a repository, or null if unknown.
 */
export function getGitHubInfo(repoBaseName: string): GitHubRepoInfo | null {
  return REPO_GITHUB_URLS[repoBaseName] ?? null;
}

/**
 * Build a GitHub blob (file) URL pointing to HEAD for the given file path.
 * Returns null when the repository is not in the known-URL mapping.
 */
export function getGitHubFileUrl(repoBaseName: string, filePath: string): string | null {
  const info = getGitHubInfo(repoBaseName);
  if (!info) return null;
  return `${info.url}/blob/HEAD/${filePath}`;
}

/**
 * Build a GitHub tree (directory) URL pointing to HEAD for the given directory
 * path. An empty or missing path resolves to the repository root tree.
 * Returns null when the repository is not in the known-URL mapping.
 */
export function getGitHubDirUrl(repoBaseName: string, dirPath: string): string | null {
  const info = getGitHubInfo(repoBaseName);
  if (!info) return null;
  // Empty path means the repository root
  if (!dirPath || dirPath === '') return `${info.url}/tree/HEAD`;
  return `${info.url}/tree/HEAD/${dirPath}`;
}
