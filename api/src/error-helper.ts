import { ErrorResponse, HelpAction } from './types';

/**
 * Helper functions for creating structured, discoverable error responses
 */

export function createNotFoundError(
  message: string,
  suggestions?: string[],
  helpActions?: HelpAction[]
): ErrorResponse {
  const error: ErrorResponse = {
    error: 'Not found',
    code: 'NOT_FOUND',
    message
  };

  if (suggestions || helpActions) {
    error.help = {};

    if (suggestions && suggestions.length > 0) {
      error.help.message = `Did you mean '${suggestions[0]}'?`;
      if (suggestions.length > 1) {
        error.details = { suggestions };
      }
    }

    if (helpActions) {
      error.help.actions = helpActions;
    }
  }

  return error;
}

export function createRepoNotFoundError(
  requestedId: string,
  allRepos: Array<{ id: string; name: string }>
): ErrorResponse {
  // Find similar repo names using fuzzy matching
  const suggestions = findSimilarRepos(requestedId, allRepos);

  const helpActions: HelpAction[] = [
    {
      description: 'List all available repositories',
      method: 'GET',
      url: '/api/repos',
      example: 'curl https://codecohesion-api.railway.app/api/repos'
    }
  ];

  // If we have suggestions, add a search-by-URL action
  if (suggestions.length > 0) {
    helpActions.push({
      description: 'Search by GitHub URL',
      method: 'GET',
      url: '/api/repos?url=https://github.com/{owner}/{repo}',
      example: 'curl \'https://codecohesion-api.railway.app/api/repos?url=https://github.com/facebook/react\''
    });
  }

  return {
    error: 'Repository not found',
    code: 'REPO_NOT_FOUND',
    message: `Repository '${requestedId}' not found`,
    details: {
      requested: requestedId,
      ...(suggestions.length > 0 && { suggestions })
    },
    help: {
      ...(suggestions.length > 0 && { message: `Did you mean '${suggestions[0]}'?` }),
      actions: helpActions
    },
    docs: 'https://github.com/paulrayner/codecohesion/tree/main/docs/api'
  };
}

export function createInvalidParameterError(
  paramName: string,
  value: unknown,
  constraint: string,
  example?: string
): ErrorResponse {
  return {
    error: 'Invalid parameter',
    code: 'INVALID_PARAMETER',
    message: `Parameter '${paramName}' ${constraint}`,
    details: {
      parameter: paramName,
      value,
      constraint
    },
    help: {
      ...(example && {
        actions: [{
          description: 'Valid example request',
          method: 'GET',
          url: example,
          example: `curl '${example}'`
        }]
      })
    },
    docs: 'https://github.com/paulrayner/codecohesion/tree/main/docs/api'
  };
}

export function createMissingParameterError(
  paramName: string,
  paramType: string,
  paramFormat: string,
  example: string
): ErrorResponse {
  return {
    error: 'Missing required parameter',
    code: 'MISSING_PARAMETER',
    message: `Parameter '${paramName}' is required`,
    details: {
      parameter: paramName,
      type: paramType,
      format: paramFormat,
      example: paramFormat
    },
    help: {
      actions: [{
        description: 'Example request with required parameter',
        method: 'GET',
        url: example,
        example: `curl '${example}'`
      }]
    },
    docs: 'https://github.com/paulrayner/codecohesion/tree/main/docs/api'
  };
}

/**
 * Find similar repository IDs using simple string similarity
 * Returns up to 3 suggestions, sorted by similarity
 */
function findSimilarRepos(
  requested: string,
  allRepos: Array<{ id: string; name: string }>
): string[] {
  const requestedLower = requested.toLowerCase();

  // Score each repo by similarity
  const scored = allRepos.map(repo => ({
    id: repo.id,
    score: calculateSimilarity(requestedLower, repo.id.toLowerCase())
  }));

  // Return top 3 matches with score > 0.3
  return scored
    .filter(s => s.score > 0.3)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map(s => s.id);
}

/**
 * Simple string similarity calculation
 * Returns a score between 0 and 1
 */
function calculateSimilarity(str1: string, str2: string): number {
  // Check for substring match
  if (str2.includes(str1) || str1.includes(str2)) {
    return 0.8;
  }

  // Calculate Levenshtein-like similarity
  const longer = str1.length > str2.length ? str1 : str2;
  const shorter = str1.length > str2.length ? str2 : str1;

  if (longer.length === 0) {
    return 1.0;
  }

  // Count matching characters
  let matches = 0;
  for (let i = 0; i < shorter.length; i++) {
    if (longer[i] === shorter[i]) {
      matches++;
    }
  }

  return matches / longer.length;
}
