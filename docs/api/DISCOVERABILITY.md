# API Discoverability Best Practices

## Overview

API discoverability refers to how easily developers and AI agents can learn about and navigate an API without requiring external documentation. A discoverable API is self-documenting and guides users through available endpoints, parameters, and workflows.

This document outlines best practices for making APIs discoverable, with specific focus on enabling both human developers and AI agents to use the API effectively.

---

## Why Discoverability Matters

### For Human Developers
- **Faster onboarding** - Learn the API by exploring it
- **Reduced documentation dependency** - API responses guide next steps
- **Better developer experience** - Less context switching between docs and code
- **Fewer support requests** - Self-explanatory errors and examples

### For AI Agents
- **Autonomous operation** - Agents can discover and use APIs without human guidance
- **Reduced token usage** - No trial-and-error; get it right the first time
- **Machine-readable schemas** - Parse API structure programmatically
- **Error recovery** - Learn correct approach from error responses

---

## Best Practices

### 1. OpenAPI/Swagger Specification

**Priority: HIGHEST** - Most important for both humans and agents.

**Implementation:**
- Provide machine-readable API schema at `/api/openapi.json`
- Serve interactive Swagger UI at `/api/docs`
- Include comprehensive parameter descriptions, constraints, and examples
- Document all response schemas with examples

**Example OpenAPI Schema:**
```yaml
openapi: 3.1.0
info:
  title: CodeCohesion API
  version: 1.0.0
  description: Repository analysis and metrics API

paths:
  /api/repos/{repoId}/stats:
    get:
      summary: Get repository statistics
      description: Returns comprehensive statistics for the specified repository
      parameters:
        - name: repoId
          in: path
          required: true
          schema:
            type: string
          description: Repository identifier (from GET /api/repos)
          example: "react-timeline-full"
      responses:
        200:
          description: Repository statistics
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/StatsResponse'
              example:
                repository:
                  id: "react-timeline-full"
                  path: "/path/to/react"
                stats:
                  totalFiles: 1234
                  totalLoc: 567890
        404:
          description: Repository not found
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Error'
```

**Benefits:**
- ✅ Agents can parse the entire API structure
- ✅ Type-safe, unambiguous documentation
- ✅ Interactive playground for testing
- ✅ Code generation tools can consume it
- ✅ Single source of truth

---

### 2. Self-Describing Root Endpoint

**Priority: HIGH** - First point of contact with the API.

**Implementation:**
- Provide comprehensive metadata at `GET /`
- Include links to main API entry points
- Show concrete usage examples
- List API capabilities
- Link to OpenAPI spec and documentation

**Example Root Response:**
```json
{
  "service": "CodeCohesion API",
  "version": "1.0.0",
  "description": "Repository analysis and metrics API",

  "_links": {
    "self": {
      "href": "/",
      "description": "API root"
    },
    "repos": {
      "href": "/api/repos",
      "description": "List all analyzed repositories or find by URL"
    },
    "docs": {
      "href": "/api/docs",
      "description": "Interactive API documentation (Swagger UI)"
    },
    "spec": {
      "href": "/api/openapi.json",
      "description": "OpenAPI 3.1 specification (machine-readable)"
    },
    "health": {
      "href": "/health",
      "description": "API health check"
    }
  },

  "examples": {
    "list_repositories": {
      "description": "Get all available repositories",
      "request": "GET /api/repos"
    },
    "find_by_github_url": {
      "description": "Find repository by GitHub URL",
      "request": "GET /api/repos?url=https://github.com/facebook/react"
    },
    "get_statistics": {
      "description": "Get repository statistics",
      "request": "GET /api/repos/react-timeline-full/stats"
    },
    "recent_contributors": {
      "description": "Get contributors from last 30 days",
      "request": "GET /api/contributors?url=https://github.com/facebook/react&days=30"
    }
  },

  "capabilities": [
    "repository_discovery",
    "url_based_lookup",
    "statistics",
    "contributor_analysis",
    "file_metrics",
    "hotspot_detection",
    "date_range_filtering",
    "path_filtering",
    "metric_sorting"
  ]
}
```

**Benefits:**
- ✅ Immediate overview of what the API can do
- ✅ Concrete examples to adapt
- ✅ Links to explore the API
- ✅ No guessing about available features

---

### 3. HATEOAS (Hypermedia as the Engine of Application State)

**Priority: HIGH** - Enable navigation through the API.

**Principle:** API responses should include links to related resources, allowing clients to discover and navigate the API by following links rather than constructing URLs manually.

**Implementation:**
- Add `_links` object to all resource responses
- Include links to related operations
- Use URL templates for parameterized endpoints
- Add action descriptors for common workflows

**Example Response with HATEOAS:**
```json
{
  "repos": [
    {
      "id": "react-timeline-full",
      "name": "react-timeline-full",
      "format": "timeline-v2",

      "_links": {
        "self": {
          "href": "/api/repos/react-timeline-full"
        },
        "stats": {
          "href": "/api/repos/react-timeline-full/stats",
          "description": "Get repository statistics"
        },
        "contributors": {
          "href": "/api/repos/react-timeline-full/contributors{?since,until}",
          "templated": true,
          "description": "Get contributors with optional date filtering"
        },
        "files": {
          "href": "/api/repos/react-timeline-full/files{?path,metric}",
          "templated": true,
          "description": "Get files with optional path prefix and metric sorting"
        },
        "hotspots": {
          "href": "/api/repos/react-timeline-full/hotspots{?limit}",
          "templated": true,
          "description": "Get top N high-churn/high-contributor files"
        }
      },

      "_actions": {
        "get_recent_contributors": {
          "method": "GET",
          "href": "/api/contributors?url=https://github.com/facebook/react&days=30",
          "description": "Get contributors from last 30 days using convenience endpoint"
        }
      }
    }
  ],

  "_links": {
    "self": {
      "href": "/api/repos"
    },
    "find": {
      "href": "/api/repos{?url}",
      "templated": true,
      "description": "Find repository by GitHub URL"
    }
  }
}
```

**Benefits:**
- ✅ Discover related endpoints from responses
- ✅ No URL construction required
- ✅ See parameter templates
- ✅ Navigate API like browsing a website
- ✅ Understand resource relationships

**Standards:**
- [HAL (Hypertext Application Language)](https://datatracker.ietf.org/doc/html/draft-kelly-json-hal)
- [JSON:API](https://jsonapi.org/)
- [RFC 5988 (Web Linking)](https://datatracker.ietf.org/doc/html/rfc5988)

---

### 4. Helpful Error Messages with Guidance

**Priority: HIGH** - Turn errors into learning opportunities.

**Principle:** When something goes wrong, guide the user toward the correct approach with actionable suggestions and examples.

**Implementation:**
- Provide structured error responses
- Include machine-readable error codes
- Add human-readable descriptions
- Suggest next steps with examples
- Link to relevant documentation
- Offer similar alternatives (fuzzy matching)

**Example Error Responses:**

**Repository Not Found:**
```json
{
  "error": "Repository not found",
  "code": "REPO_NOT_FOUND",
  "message": "Repository 'react-full' not found",

  "details": {
    "requested": "react-full",
    "suggestions": ["react-timeline-full", "react"]
  },

  "help": {
    "message": "Did you mean 'react-timeline-full'?",
    "actions": [
      {
        "description": "List all available repositories",
        "method": "GET",
        "url": "/api/repos",
        "example": "curl https://codecohesion-api.railway.app/api/repos"
      },
      {
        "description": "Search by GitHub URL",
        "method": "GET",
        "url": "/api/repos?url=https://github.com/facebook/react",
        "example": "curl 'https://codecohesion-api.railway.app/api/repos?url=https://github.com/facebook/react'"
      }
    ]
  },

  "docs": "https://codecohesion-api.railway.app/api/docs#repository-lookup"
}
```

**Invalid Parameter:**
```json
{
  "error": "Invalid parameter",
  "code": "INVALID_PARAMETER",
  "message": "Parameter 'limit' must be between 1 and 100",

  "details": {
    "parameter": "limit",
    "value": "150",
    "constraint": "1 <= limit <= 100"
  },

  "help": {
    "example": "curl 'https://codecohesion-api.railway.app/api/repos/react-timeline-full/hotspots?limit=50'"
  },

  "docs": "https://codecohesion-api.railway.app/api/docs#hotspots"
}
```

**Missing Required Parameter:**
```json
{
  "error": "Missing required parameter",
  "code": "MISSING_PARAMETER",
  "message": "Parameter 'url' is required",

  "details": {
    "parameter": "url",
    "type": "string",
    "format": "GitHub repository URL",
    "example": "https://github.com/facebook/react"
  },

  "help": {
    "example": "curl 'https://codecohesion-api.railway.app/api/contributors?url=https://github.com/facebook/react&days=30'"
  },

  "docs": "https://codecohesion-api.railway.app/api/docs#convenience-endpoints"
}
```

**Benefits:**
- ✅ Users learn the correct approach from errors
- ✅ Reduced frustration and support requests
- ✅ Agents can self-correct
- ✅ Machine-readable error codes enable programmatic handling
- ✅ Examples provide working code to try next

---

### 5. Rich Parameter Documentation in Responses

**Priority: MEDIUM** - Help users discover query options.

**Principle:** Responses should include metadata about available query parameters, so users can discover filtering, sorting, and pagination options without reading external docs.

**Implementation:**
- Add `_query` metadata object to responses
- Document available parameters with types and formats
- Show examples of parameter usage
- Indicate optional vs. required

**Example:**
```json
{
  "repository": { "id": "react-timeline-full" },
  "period": { "since": null, "until": null },
  "contributors": [...],
  "total": 42,

  "_query": {
    "available_parameters": {
      "since": {
        "type": "string",
        "format": "YYYY-MM-DD",
        "required": false,
        "description": "Filter contributors active on or after this date",
        "example": "2024-01-01"
      },
      "until": {
        "type": "string",
        "format": "YYYY-MM-DD",
        "required": false,
        "description": "Filter contributors active on or before this date",
        "example": "2024-12-31"
      }
    },
    "examples": [
      "/api/repos/react-timeline-full/contributors?since=2024-01-01",
      "/api/repos/react-timeline-full/contributors?since=2024-01-01&until=2024-06-30"
    ]
  }
}
```

**Benefits:**
- ✅ Discover filtering options from responses
- ✅ Understand parameter constraints
- ✅ Get working examples
- ✅ No need to consult external docs

---

### 6. OPTIONS Method Support

**Priority: LOW** - Advanced discoverability feature.

**Principle:** Support `OPTIONS` HTTP method to describe endpoint capabilities.

**Implementation:**
```bash
curl -X OPTIONS https://api.example.com/api/repos/react/contributors
```

**Response:**
```json
{
  "methods": ["GET"],
  "description": "Get contributors with optional date filtering",
  "parameters": {
    "path": {
      "repoId": {
        "type": "string",
        "description": "Repository identifier",
        "example": "react-timeline-full"
      }
    },
    "query": {
      "since": {
        "type": "string",
        "format": "YYYY-MM-DD",
        "required": false,
        "description": "Filter contributors active on or after this date"
      },
      "until": {
        "type": "string",
        "format": "YYYY-MM-DD",
        "required": false,
        "description": "Filter contributors active on or before this date"
      }
    }
  },
  "response_schema": {
    "$ref": "https://api.example.com/api/openapi.json#/components/schemas/ContributorsResponse"
  }
}
```

**Benefits:**
- ✅ Discover endpoint capabilities without making requests
- ✅ Useful for auto-generated clients
- ✅ Standard HTTP method

---

## Real-World Examples

### Excellent Discoverability

**GitHub API:**
```bash
curl https://api.github.com/
```
- Comprehensive list of URL templates
- Links to all major resources
- Consistent structure across endpoints

**Stripe API:**
- Rich error messages with suggestions
- Links to related resources in responses
- Comprehensive OpenAPI spec
- Interactive API explorer

**AWS APIs:**
- Machine-readable service definitions
- Code generation from schemas
- Consistent error format across services

### Poor Discoverability

- No root endpoint documentation
- Error messages with no guidance: `{"error": "bad request"}`
- No examples in responses
- Must construct URLs manually
- No OpenAPI spec

---

## Implementation Status

### Phase 1: Quick Wins — Done
- [x] HATEOAS `_links` on all repository listing responses (stats, contributors, files, hotspots, imports, structure, complexity, impact, context, coupling, health)
- [x] Improved error messages with descriptive text (404 vs 500 distinction)
- [x] Path traversal protection with security tests

### Phase 2: OpenAPI Documentation — Done
- [x] OpenAPI 3.1 spec at `GET /api/docs` covering all 19 endpoints
- [x] Swagger UI at `GET /api/docs/ui` (CDN-loaded, no dependency)
- [x] Parameter descriptions and response schemas

### Phase 3: Polish (remaining)
- [ ] Add `_query` metadata to responses
- [ ] Implement `OPTIONS` method support
- [ ] Add `_actions` for common workflows
- [ ] Add fuzzy matching for repo lookup errors
- [ ] Enhance root endpoint with links, examples, and capabilities list

---

## Benefits Summary

### For Human Developers
- ⚡ Faster onboarding
- 📖 Self-documenting API
- 🎯 Reduced documentation dependency
- 🔍 Exploratory learning through API responses
- 💡 Learn from error messages

### For AI Agents
- 🤖 Autonomous discovery and usage
- 📊 Machine-readable schemas
- 🎯 First-time-right requests
- 🔄 Self-correction from errors
- 💾 Reduced token usage

### For API Maintainers
- 📉 Fewer support requests
- 📚 Documentation lives with the API
- ✅ Better API quality
- 🔧 Easier to evolve (HATEOAS enables URL changes)

---

## References

- [OpenAPI Specification](https://spec.openapis.org/oas/latest.html)
- [HAL - Hypertext Application Language](https://datatracker.ietf.org/doc/html/draft-kelly-json-hal)
- [JSON:API Specification](https://jsonapi.org/)
- [RFC 7807 - Problem Details for HTTP APIs](https://datatracker.ietf.org/doc/html/rfc7807)
- [REST API Design Rulebook (O'Reilly)](https://www.oreilly.com/library/view/rest-api-design/9781449317904/)
- [API Design Patterns (Manning)](https://www.manning.com/books/api-design-patterns)

---

## Conclusion

API discoverability is crucial for both human developers and AI agents. The most important improvements are:

1. **OpenAPI specification** - Single source of truth, machine-readable
2. **Self-describing root** - Immediate overview and examples
3. **HATEOAS links** - Navigate API by following links
4. **Helpful errors** - Learn from mistakes, get examples

Investing in discoverability reduces friction, improves developer experience, and enables autonomous agent usage—all with relatively modest implementation effort.
