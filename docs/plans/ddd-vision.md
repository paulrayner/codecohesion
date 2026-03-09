# Vision: DDD Bounded Context Detection

**Implementation Status:** The temporal coupling foundation is implemented — `CouplingAnalyzer` with Louvain clustering exists in `processor/src/coupling-analyzer.ts`, and the `--coupling` CLI flag works. The full DDD vision below (ubiquitous language analysis, vocabulary clustering, connascence detection, bounded context scoring) remains future work.

---

## Problem Statement

**Original Request:**
> Research the option of making this application more interesting as an analysis tool for Domain-Driven Design (DDD). Based on the ROOT state of the repository, identify whether a repo is a single bounded context or actually contains multiple bounded contexts.

**Core Challenge:**
Identifying bounded context boundaries requires semantic analysis of business language expressed through:
- Method names
- Variable names
- Class names
- File naming patterns

**Key Hypothesis - Connascence of Name:**
If the same token is changed in 2 different files in the same commit (e.g., `MakeBooking` becomes `MakeReservation`), it's likely that both files are in the same bounded context. This is a form of **connascence of name** - when components must agree on the name of something to maintain system correctness.

**Example from React:**
Commit [aab72cb1c](https://github.com/facebook/react/commit/aab72cb1cbfc30f07af7b949fb9dc8d7497d73ca) renamed `ReactFiberContext` → `ReactFiberLegacyContext` across 7 files in one atomic change. This demonstrates strong coupling and shared vocabulary - a marker of a cohesive bounded context.

---

## Why This Matters for DDD

In Domain-Driven Design, a **bounded context** is:
- A linguistic boundary where domain terms have consistent meaning
- A logical boundary for a model that applies within a specific context
- Often aligned with team ownership and deployment units

**Problems This Analysis Can Solve:**
1. **Hidden Context Boundaries** - Discover that a "monolith" actually contains 3-4 distinct contexts
2. **Context Violations** - Identify files that belong to multiple contexts (high coupling across boundaries)
3. **Refactoring Candidates** - Find where to split a large codebase
4. **Team Alignment** - Validate that directory structure matches domain boundaries
5. **Microservice Extraction** - Identify cohesive service boundaries

---

## Research Findings

### Industry Tools Using Similar Approaches

**1. [CodeScene](https://codescene.com) (Commercial)**
- Uses **temporal coupling** to detect architectural decay
- Tracks files that change together over time
- Metrics: degree of coupling, average revisions, architectural boundaries
- Helps identify software clones, hidden dependencies, unit test relevance
- Quote: *"A Temporal Coupling analysis often gives us deep and unexpected insights into how well our designs stand the test of time."*

**2. [Mono2Micro](https://www.ibm.com/products/mono2micro) (IBM Research)**
- Decomposes monoliths to microservices using **logical coupling** from git history
- Combines static analysis, runtime behavior, and version control data
- Uses clustering algorithms to identify service boundaries
- Proven effective on enterprise Java applications

**3. [Service Cutter](https://github.com/ServiceCutter/ServiceCutter) (Academic)**
- Structured approach using 16 coupling criteria from literature
- Applies clustering algorithms to weighted dependency graphs
- Considers both static and evolutionary coupling

**4. [temporal-coupling](https://github.com/shepmaster/temporal-coupling) (Open Source)**
- GitHub tool by shepmaster
- Analyzes git repositories to find files commonly changed together
- Outputs:
  - Most modified files
  - Most modified pairs of files
  - Common pairs of most modified files
- Simple premise: "Files that change at the same time are coupled"

### Academic Research (2024-2025)

**Monolith Decomposition Trends:**
- Modern approaches combine **3 analysis dimensions**:
  1. **Static code analysis** - dependencies, imports, call graphs
  2. **Dynamic runtime behavior** - actual usage patterns
  3. **Evolutionary data** - git history, temporal coupling

**Coupling Types Used:**
1. **Logical Coupling** - Files changed together in commits
2. **Semantic Coupling** - Shared domain vocabulary
3. **Contributor Coupling** - Same developers work on same files

**Recent ML Approaches:**
- Variational Autoencoders (VAE) + Graph Neural Networks (GNN) for boundary detection
- Automated clustering with supervised learning
- Process mining for microservice identification

### Key Insight: Temporal Coupling is Already Captured!

Your application already collects the foundation data needed:
- Full commit history with file changes ([full-delta-analyzer.ts:111-143](../processor/src/full-delta-analyzer.ts#L111-L143))
- Which files change together in commits ([types.ts:72-89](../processor/src/types.ts#L72-L89))
- Commit siblings highlighting ([TreeVisualizer.ts:178-198](../viewer/src/TreeVisualizer.ts#L178-L198))

**We're 60% of the way there!**

---

## Technical Approaches (Progressive Complexity)

### Level 1: File Co-Change Analysis (Easiest - High Value)

**What:** Build a coupling matrix showing which files change together over time

**How It Works:**
```typescript
// For each commit:
for (commit of allCommits) {
  const files = [...commit.changes.filesModified, ...commit.changes.filesAdded]

  // Increment coupling score for every file pair
  for (file1 of files) {
    for (file2 of files where file2 != file1) {
      couplingMatrix[file1][file2]++
    }
  }
}

// Calculate coupling percentage
coupling(A, B) = changes_together / total_changes_to_A
```

**Data Source:**
Already available in `CommitSnapshot.changes` from your timeline format!

**Clustering Algorithms:**
- **Hierarchical clustering** - Build dendogram showing nested relationships
- **Louvain modularity** - Fast community detection (used by graph tools)
- **Newman's algorithm** - What CodeScene uses
- **Graph partitioning** - Min-cut algorithms for optimal splits

**Output Visualizations:**
1. **Coupling Heatmap** - Matrix showing file-to-file coupling strength
2. **Coupling Graph** - Nodes = files, edges = coupling (thickness = strength)
3. **Cluster Assignments** - Files grouped into proposed bounded contexts
4. **Cross-Cluster Coupling** - Integration points between contexts

**Bounded Context Inference:**
- ✅ **Strong coupling clusters** → Likely same bounded context
- ✅ **Weak coupling between clusters** → Different bounded contexts
- ⚠️ **Cross-cluster coupling** → Integration points or architectural issues
- 🚫 **Orphan files** → Low coupling everywhere (utilities, configs)

**Complexity:** **Low** ⭐
**Value:** **High** ⭐⭐⭐ - Immediate architectural insights with existing data

**Libraries:**
- JavaScript: `graphology`, `d3-force`, `ml-hclust`
- Python: `networkx`, `scipy.cluster`, `scikit-learn`

---

### Level 2: Directory + Coupling Hybrid (Easy - Quick Win)

**What:** Combine directory structure with coupling analysis to validate organizational boundaries

**Rationale:**
Teams often organize code by bounded context:
- `src/booking/` - Booking context
- `src/inventory/` - Inventory context
- `src/payments/` - Payments context

**Does the directory structure match coupling patterns?**

**Algorithm:**
```typescript
// For each top-level directory:
1. Calculate intra-directory coupling (files within same directory)
2. Calculate inter-directory coupling (files across directories)
3. Cohesion score = internal_coupling / (internal_coupling + external_coupling)
4. Flag directories with low cohesion (may contain multiple contexts)
5. Flag high cross-directory coupling (architectural issues)
```

**Metrics:**
- **Cohesion Score** - How self-contained is this directory? (0-1)
- **Coupling Ratio** - External coupling / Internal coupling
- **Boundary Violations** - Files in directory A strongly coupled to directory B

**Output Visualizations:**
1. **Directory Cohesion Heatmap** - Color by cohesion score
2. **Cross-Directory Edges** - Show coupling between directories
3. **Suggested Moves** - Files that might belong in different directories
4. **Boundary Violations Report** - Problematic cross-directory dependencies

**Bounded Context Inference:**
- ✅ **High cohesion directory** → Well-bounded context
- ⚠️ **Low cohesion directory** → May contain multiple contexts or be a "junk drawer"
- 🚫 **Strong cross-directory coupling** → Leaky abstraction, shared concepts

**Complexity:** **Low** ⭐
**Value:** **Medium-High** ⭐⭐⭐ - Quick validation of existing structure

---

### Level 3: Token Frequency Analysis (Medium - Static Semantic)

**What:** Extract identifiers from source files and group by shared vocabulary

**Rationale:**
Bounded contexts have **ubiquitous language** - consistent domain terminology:
- Booking context: `Booking`, `Reservation`, `Appointment`, `Schedule`
- Payment context: `Payment`, `Invoice`, `Transaction`, `Receipt`
- Shared vocabulary = shared bounded context

**Algorithm:**
```typescript
// 1. Extract identifiers from each file (simple regex)
const identifiers = extractIdentifiers(fileContent)
// Examples: MakeBooking, ReservationService, BookingRepository, getAppointmentById

// 2. Build TF-IDF to find domain-specific terms
// (filters out common words like "get", "set", "data", "manager", "service")
const domainTerms = calculateTFIDF(identifiers)

// 3. Create vocabulary fingerprint for each file
const fingerprint = topNDomainTerms(file, N=20)

// 4. Calculate cosine similarity between file vocabularies
similarity(fileA, fileB) = cosine(fingerprintA, fingerprintB)

// 5. Cluster files by vocabulary similarity
const vocabularyClusters = clusterBySharedTerms(domainTerms)
```

**Identifier Extraction (Simple Regex):**
```typescript
// PascalCase: BookingService, MakeReservation
const pascalCase = /\b[A-Z][a-z]+([A-Z][a-z]+)+\b/g

// camelCase: makeBooking, getReservation
const camelCase = /\b[a-z]+([A-Z][a-z]+)+\b/g

// Split on case boundaries and underscores
// BookingService → ["booking", "service"]
```

**TF-IDF Scoring:**

TF-IDF (Term Frequency-Inverse Document Frequency) is a numerical statistic that measures how important a word is to a document within a collection of documents.

**Term Frequency (TF)** - How often a term appears in a file:
```
tf(term, file) = count(term in file) / total_tokens_in_file
```

**Inverse Document Frequency (IDF)** - How rare/unique a term is across all files:
```
idf(term) = log(total_files / files_containing_term)
```

**Combined TF-IDF Score:**
```
tfidf(term, file) = tf(term, file) × idf(term)
```

**Interpretation:**
- **High TF-IDF** = Distinctive domain term (e.g., "Booking", "Reservation")
- **Low TF-IDF** = Common technical term (e.g., "Service", "Manager", "create")

**Example:**
File: `BookingService.ts` with tokens: `["booking", "service", "reservation", "create", "booking", "manager"]`

| Term | TF | IDF | TF-IDF | Interpretation |
|------|----|----|--------|----------------|
| "booking" | 0.33 (2/6) | 3.0 | **0.99** | **Distinctive domain term** |
| "reservation" | 0.17 (1/6) | 3.5 | **0.59** | **Distinctive domain term** |
| "service" | 0.17 (1/6) | 0.22 | 0.04 | Common technical term |
| "create" | 0.17 (1/6) | 0.69 | 0.12 | Generic verb |

Filter: Keep terms with TF-IDF > 0.5 → `["booking", "reservation"]` represent the domain vocabulary

**Output Visualizations:**
1. **Vocabulary Word Cloud** - Per-cluster domain terms
2. **File Similarity Graph** - Nodes = files, edges = vocabulary overlap
3. **Term Co-occurrence Matrix** - Which terms appear together
4. **Cluster Vocabulary Overlap** - Shared terms between clusters

**Bounded Context Inference:**
- ✅ **Files with shared distinctive terms** → Same bounded context
- ⚠️ **Files using terms from multiple clusters** → Integration layer or context violation
- 🚫 **Generic technical terms** → Infrastructure, not domain logic

**Challenges:**
- Distinguishing domain terms from technical terms (solved by TF-IDF)
- Handling synonyms and related terms (e.g., "Booking" vs "Reservation")
- Language-specific naming conventions (snake_case, kebab-case)
- Abbreviations and acronyms

**Complexity:** **Medium** ⭐⭐
**Value:** **Medium** ⭐⭐ - Adds semantic layer but has false positives

**Libraries:**
- JavaScript: `natural` (NLP), `stopword` (filter common words)
- Python: `scikit-learn.TfidfVectorizer`, `nltk`

---

### Level 3.5: Ubiquitous Language Extensions (Medium - DDD-Specific)

**What:** Additional analyses focused on DDD's ubiquitous language principle

**Rationale:**
DDD emphasizes that bounded contexts should have consistent, unambiguous terminology. These extensions help validate and surface the ubiquitous language from code.

**Additional Analyses:**

**1. Domain Glossary Generation**
```typescript
// For each cluster (proposed bounded context):
const glossary = extractDomainGlossary(cluster)

// Output:
{
  "contextName": "Booking Context",
  "terms": [
    {
      "term": "booking",
      "frequency": 245,
      "tfidf": 0.98,
      "locations": ["BookingService.ts", "BookingController.ts", ...],
      "relatedTerms": ["reservation", "appointment"]
    }
  ]
}
```

**Output:** Markdown glossary document per bounded context
```markdown
# Booking Context - Domain Glossary

## Core Terms
- **Booking** (245 occurrences) - Primary domain entity
- **Reservation** (187 occurrences) - Synonym for booking
- **Appointment** (156 occurrences) - Scheduled booking

## Related Terms
- Schedule, TimeSlot, Availability
```

**2. Terminology Consistency Analysis**
```typescript
// Detect inconsistent naming patterns within a cluster
const inconsistencies = findTerminologyInconsistencies(cluster)

// Example findings:
{
  "potentialInconsistencies": [
    {
      "terms": ["Booking", "Reservation", "Appointment"],
      "type": "synonyms",
      "files": ["BookingService.ts", "ReservationController.ts"],
      "suggestion": "Consider standardizing on one term"
    },
    {
      "terms": ["User", "Customer", "Client"],
      "type": "entity-naming",
      "suggestion": "Same concept referred to by different names"
    }
  ]
}
```

**Output Visualizations:**
- **Synonym clusters** - Groups of terms that might mean the same thing
- **Naming inconsistency heatmap** - Highlight files using different terms
- **Standardization suggestions** - AI-generated recommendations

**3. Cross-Context Terminology Conflicts**
```typescript
// Find terms used in multiple contexts with potentially different meanings
const conflicts = findCrossContextTerms(allClusters)

// Example:
{
  "term": "Order",
  "contexts": [
    {
      "context": "Sales Context",
      "usage": "CustomerOrder, PlaceOrder, OrderTotal",
      "meaning": "A purchase request from customer"
    },
    {
      "context": "Inventory Context",
      "usage": "SupplierOrder, PurchaseOrder, OrderStock",
      "meaning": "A purchase request to supplier"
    }
  ],
  "conflict": "Same term, different meanings - bounded context violation"
}
```

**Output Visualizations:**
- **Shared term matrix** - Which terms appear in multiple contexts
- **Semantic conflict warnings** - Terms with different meanings across contexts
- **Context boundary recommendations** - Suggest renaming or refactoring

**4. Domain Language Evolution Timeline**
```typescript
// Track how terminology changes over time
const evolution = analyzeTerminologyEvolution(commits, term="Booking")

// Output:
{
  "term": "Booking",
  "timeline": [
    {
      "date": "2020-01-15",
      "event": "First appearance",
      "commit": "abc123",
      "files": ["BookingService.ts"]
    },
    {
      "date": "2021-03-22",
      "event": "Renamed: Booking → Reservation",
      "commit": "def456",
      "files": ["BookingService.ts", "BookingController.ts"],
      "scope": "Widespread rename (5 files)"
    },
    {
      "date": "2022-06-10",
      "event": "Reverted: Reservation → Booking",
      "commit": "ghi789",
      "reason": "Return to original terminology"
    }
  ]
}
```

**Output Visualizations:**
- **Term lifecycle graph** - Birth, renames, death of domain terms
- **Terminology churn** - How often terms change over time
- **Refactoring timeline** - Major vocabulary refactorings highlighted

**5. Ubiquitous Language Validation Report**
```typescript
// Generate report on language consistency within bounded contexts
const report = generateUbiquitousLanguageReport(cluster)

// Metrics:
{
  "contextName": "Booking Context",
  "languageConsistency": {
    "score": 0.82, // 0-1, higher = more consistent
    "distinctiveTerms": 23,
    "sharedWithOtherContexts": 5,
    "potentialSynonyms": 3,
    "namingInconsistencies": 2
  },
  "recommendations": [
    "Standardize 'Booking' vs 'Reservation' (used interchangeably)",
    "Consider renaming 'User' to 'Customer' for clarity",
    "Term 'Order' conflicts with Inventory context - consider prefix"
  ]
}
```

**Output:**
- **PDF/HTML Report** - Comprehensive language analysis per context
- **Health score** - How consistent is the ubiquitous language?
- **Actionable recommendations** - Specific refactoring suggestions

**Bounded Context Inference:**
- ✅ **High language consistency** → Well-defined bounded context
- ✅ **Distinctive terminology** → Clear domain model
- ⚠️ **Term conflicts across contexts** → Poor isolation, needs refactoring
- ⚠️ **High synonym usage** → Language inconsistency within context
- 🚫 **Generic technical terms only** → Missing domain model

**Complexity:** **Medium** ⭐⭐
**Value:** **High** ⭐⭐⭐ - Core DDD principle, actionable insights

**Libraries:**
- JavaScript: `natural` (NLP), `compromise` (text analysis), `levenshtein` (similarity)
- Python: `spaCy` (NLP), `gensim` (topic modeling)

---

### Level 4: Connascence of Name Detection (High - Original Idea!)

**What:** Detect when the same identifier is renamed across multiple files in one commit

**Example Scenario:**
```
Commit: "Rename MakeBooking to MakeReservation for clarity"

File: src/booking/BookingService.ts
- function MakeBooking(...)
+ function MakeReservation(...)

File: src/booking/BookingController.ts
- import { MakeBooking } from './BookingService'
+ import { MakeReservation } from './BookingService'
- const result = MakeBooking(data)
+ const result = MakeReservation(data)

File: tests/booking.test.ts
- describe('MakeBooking', () => {
+ describe('MakeReservation', () => {
```

**This is STRONG evidence all 3 files are in the same bounded context!**

**Algorithm:**
```typescript
// For each commit with multiple modified files:

1. Parse git diff for each file
2. Extract changed identifiers (before/after)
   Example diff line:
   - const result = MakeBooking(data)
   + const result = MakeReservation(data)

   Extracted change: "MakeBooking" → "MakeReservation"

3. Build rename map per file:
   fileA: { "MakeBooking" → "MakeReservation" }
   fileB: { "MakeBooking" → "MakeReservation" }
   fileC: { "MakeBooking" → "MakeReservation" }

4. Detect consistent renames (same pattern in 2+ files)
   Match found: "MakeBooking" → "MakeReservation" in 3 files

5. Record connascence relationship:
   connascence(fileA, fileB, fileC, weight=HIGH)

6. Build weighted connascence graph:
   - More consistent renames together = stronger coupling
   - One-off renames = weaker signal
```

**Real-World Example from React:**

Commit [aab72cb1c](https://github.com/facebook/react/commit/aab72cb1cbfc30f07af7b949fb9dc8d7497d73ca):
```
rename ReactFiberContext to ReactFiberLegacyContext (#33622)

M  packages/react-reconciler/src/ReactFiberBeginWork.js
-} from './ReactFiberContext';
+} from './ReactFiberLegacyContext';

M  packages/react-reconciler/src/ReactFiberClassComponent.js
-} from './ReactFiberContext';
+} from './ReactFiberLegacyContext';

... (5 more files with same rename)

R100  packages/react-reconciler/src/ReactFiberContext.js
   →  packages/react-reconciler/src/ReactFiberLegacyContext.js
```

**Perfect connascence of name across 7 files!**

**Technical Implementation:**

**Option A: Simple Regex Diff Parsing (Easier)**
```typescript
// Parse unified diff format
const diffLines = gitShow(commitHash, filePath).split('\n')

for (line of diffLines) {
  if (line.startsWith('-') && !line.startsWith('---')) {
    const removedTokens = extractIdentifiers(line.substring(1))
  }
  if (line.startsWith('+') && !line.startsWith('+++')) {
    const addedTokens = extractIdentifiers(line.substring(1))
  }
}

// Find token replacements
const changes = findTokenReplacements(removedTokens, addedTokens)
```

**Option B: Git Word-Diff (Better)**
```bash
git show --word-diff=porcelain <hash> <file>
```

Output format:
```
~
 function
-MakeBooking
+MakeReservation
~
```

Easier to parse token-level changes!

**Identifier Extraction:**
```typescript
// Match PascalCase, camelCase, UPPER_CASE
const identifierPattern = /\b[A-Z][a-zA-Z0-9_]*\b/g

// Filter out common words to reduce noise
const stopwords = ['get', 'set', 'is', 'has', 'data', 'this', 'that', ...]
```

**Handling False Positives:**

**Challenge:** Common words like "data", "config", "manager" might be renamed coincidentally

**Solutions:**
1. **Minimum occurrence threshold** - Only track renames in 2+ files
2. **Token complexity filter** - Ignore single-word tokens, prefer compound names
3. **Semantic significance** - Use TF-IDF to filter generic terms
4. **Context window** - Check if surrounding tokens also changed (stronger signal)

**Output Visualizations:**
1. **Connascence Graph** - Nodes = files, edges = connascence events
2. **Rename Timeline** - Show major refactorings over time
3. **Connascence Heatmap** - Which file pairs have highest connascence
4. **Cluster Comparison** - Temporal coupling + connascence combined

**Bounded Context Inference:**
- ✅ **High connascence** → Very strong signal for same bounded context
- ✅ **Consistent rename patterns** → Shared ubiquitous language
- ⚠️ **Cross-cluster connascence** → Contexts may be poorly separated
- 🚫 **No connascence** → Files truly independent

**Complexity:** **High** ⭐⭐⭐
**Value:** **High** ⭐⭐⭐ - Strongest signal for bounded context boundaries

---

### Level 5: Full AST Analysis with Tree-Sitter (Highest - Most Accurate)

**What:** Parse source files to extract all references to types, methods, variables with full semantic accuracy

**Why Tree-Sitter?**
- Multi-language incremental parser
- Generates concrete syntax trees (CST)
- Query-based node extraction
- **Blazing fast** - millisecond response times
- Used by VSCode, Neovim, Emacs
- Supports 50+ languages

**What It Enables:**

**Accurate Identifier Classification:**
```typescript
// Distinguish between:
- Class names: BookingService, ReservationManager
- Method names: makeBooking(), createReservation()
- Variable names: booking, reservationId
- Type names: Booking, ReservationDTO
- Imports: import { Booking } from './types'
```

**Track Actual References (Not String Matching):**
```typescript
// Tree-sitter query to find all class references
const query = `
(class_declaration
  name: (identifier) @class_name)

(type_annotation
  (type_identifier) @type_reference)

(call_expression
  function: (identifier) @method_call)
`

const matches = query.matches(syntaxTree)
// Returns: BookingService, Booking (type), makeBooking (call)
```

**Build Semantic Dependency Graph:**
```typescript
// For each file:
1. Parse to AST with tree-sitter
2. Extract all domain entities (classes, types, interfaces)
3. Extract all references to those entities
4. Build graph: File A → uses → BookingService → defined in → File B
5. Calculate semantic coupling based on shared entity usage
```

**Advantages Over Regex:**
- **No false positives** from string literals, comments, or partial matches
- **Language-aware** - handles different syntax correctly
- **Contextual** - knows if identifier is import, declaration, or usage
- **Refactoring-safe** - tracks actual semantic relationships

**Example Analysis:**

**File A: BookingService.ts**
```typescript
export class BookingService {
  createBooking(data: BookingData): Booking {
    // ...
  }
}
```

**File B: BookingController.ts**
```typescript
import { BookingService } from './BookingService'
import { Booking } from './types'

class BookingController {
  private service: BookingService

  handleRequest() {
    const booking: Booking = this.service.createBooking(data)
  }
}
```

**Tree-Sitter Analysis:**
```typescript
FileA exports: [BookingService (class), createBooking (method), Booking (type)]
FileB imports: [BookingService (from FileA), Booking (type)]
FileB uses: [BookingService (field type), Booking (variable type), createBooking (method call)]

Semantic coupling(A, B) = HIGH
Shared vocabulary: [BookingService, Booking, createBooking]
```

**Implementation with Node.js:**
```typescript
import Parser from 'tree-sitter'
import TypeScript from 'tree-sitter-typescript'

const parser = new Parser()
parser.setLanguage(TypeScript.typescript)

const tree = parser.parse(sourceCode)

// Query for class declarations
const classQuery = parser.getLanguage().query(`
  (class_declaration
    name: (type_identifier) @class_name)
`)

const classes = classQuery.matches(tree.rootNode)
```

**Clustering with Semantic Data:**
```typescript
// Build graph
for (file of allFiles) {
  const entities = extractEntities(file) // Classes, types, interfaces
  const references = extractReferences(file) // What it uses

  // Create edges
  for (ref of references) {
    const definingFile = findDefinition(ref)
    graph.addEdge(file, definingFile, weight=referenceCount)
  }
}

// Apply community detection
const clusters = louvainClustering(graph)
```

**Output Visualizations:**
1. **Semantic Dependency Graph** - Accurate "who uses what" relationships
2. **Entity Co-usage Matrix** - Which domain entities are used together
3. **Import Heatmap** - Cross-directory import patterns
4. **Vocabulary Overlap** - Shared types/classes between files

**Bounded Context Inference:**
- ✅ **Files sharing domain entities** → Same bounded context
- ✅ **Low cross-cluster imports** → Well-isolated contexts
- ⚠️ **Shared types across clusters** → Bounded context leakage or shared kernel
- 🚫 **Heavy cross-cluster dependencies** → Context boundaries unclear

**Multi-Language Support:**
Tree-sitter has grammars for 50+ languages:
- JavaScript/TypeScript: `tree-sitter-javascript`, `tree-sitter-typescript`
- Java: `tree-sitter-java`
- Python: `tree-sitter-python`
- C#: `tree-sitter-c-sharp`
- Go: `tree-sitter-go`
- Ruby: `tree-sitter-ruby`

**Challenges:**
- **Complexity** - AST parsing and querying requires domain knowledge
- **Language-specific** - Queries differ per language
- **Performance** - Parsing thousands of files (but tree-sitter is fast!)
- **Dependencies** - Need native bindings for tree-sitter

**Complexity:** **Very High** ⭐⭐⭐⭐⭐
**Value:** **Very High** ⭐⭐⭐⭐⭐ - Research-grade accuracy

**Libraries:**
- Node.js: `tree-sitter`, `tree-sitter-typescript`, `tree-sitter-javascript`
- Web: `web-tree-sitter` (WASM bindings)
- Documentation: https://tree-sitter.github.io/tree-sitter/

---

## Recommended Implementation Roadmap

### Phase 1: Temporal Coupling Matrix

**Goal:** Leverage existing commit data to build coupling matrix and clustering

**Tasks:**
1. Add coupling analysis module to processor
2. Parse existing `CommitSnapshot` data to build co-change matrix
3. Implement coupling percentage calculation
4. Add Louvain clustering algorithm
5. Output coupling graph as JSON

**Deliverables:**
- `coupling-analysis.ts` - New processor module
- Enhanced timeline format with coupling data
- JSON output: `{ nodes: [], edges: [], clusters: [] }`

**Testing:**
- Run on React repository (21K commits)
- Validate against known architectural boundaries
- Compare temporal coupling with directory structure

**Success Metrics:**
- Coupling matrix generated in <30 seconds for React-sized repos
- Clusters align with known modules (React core, reconciler, scheduler)
- Cross-cluster coupling identifies integration points

---

### Phase 2: Directory Cohesion Analysis

**Goal:** Combine coupling with directory structure to validate organization

**Tasks:**
1. Extend coupling analysis to calculate per-directory metrics
2. Calculate cohesion scores (internal vs external coupling)
3. Identify boundary violations (high cross-directory coupling)
4. Generate directory cohesion report

**Deliverables:**
- Directory cohesion scores in coupling output
- Boundary violations report
- Suggested file moves based on coupling patterns

**Testing:**
- Analyze React's `packages/` structure
- Identify tightly coupled packages
- Validate against React's modular architecture

**Success Metrics:**
- Clear cohesion differences between well-bounded and shared directories
- Boundary violations match known architectural issues
- Suggested moves align with actual refactorings

---

### Phase 3: Token Frequency Analysis

**Goal:** Add vocabulary-based clustering using identifier extraction

**Tasks:**
1. Implement identifier extraction with regex (PascalCase, camelCase)
2. Build TF-IDF model for domain term extraction
3. Calculate file vocabulary similarity (cosine similarity)
4. Combine vocabulary clustering with temporal coupling
5. Generate cluster vocabulary reports

**Deliverables:**
- `vocabulary-analysis.ts` - Token extraction and TF-IDF
- Per-cluster vocabulary word clouds
- Combined coupling + vocabulary clusters

**Testing:**
- Extract identifiers from React repository
- Identify distinctive domain terms per module
- Compare vocabulary clusters with temporal clusters

**Success Metrics:**
- Distinctive terms identify known modules (e.g., "Fiber", "Hook", "Scheduler")
- Vocabulary similarity correlates with temporal coupling
- Combined approach produces better clusters than either alone

---

### Phase 4: Connascence of Name Detection

**Goal:** Implement rename detection to build strongest coupling signal

**Tasks:**
1. Implement git word-diff parsing (`--word-diff=porcelain`)
2. Extract identifier changes (before/after) per file per commit
3. Detect consistent renames across multiple files in same commit
4. Build connascence graph (nodes = files, edges = rename events)
5. Calculate connascence-weighted coupling scores
6. Generate rename timeline visualization

**Deliverables:**
- `connascence-detector.ts` - Rename detection module
- Connascence graph in coupling output
- Rename timeline showing major refactorings
- Combined coupling score (temporal + connascence)

**Testing:**
- Test on React commit aab72cb1c (ReactFiberContext rename)
- Identify all major refactorings in React history
- Validate connascence edges match known module boundaries

**Success Metrics:**
- Successfully detects 90%+ of multi-file renames
- Low false positive rate (<10%)
- Connascence graph reveals cohesive modules
- Combined score improves cluster quality over temporal alone

---

### Phase 5 (Future): Tree-Sitter AST Analysis

**Goal:** Research-grade semantic analysis with full AST parsing

**Tasks:**
1. Integrate tree-sitter with Node.js processor
2. Implement language-specific entity extraction (classes, methods, types)
3. Build semantic dependency graph (imports, usage, inheritance)
4. Calculate semantic coupling based on shared entities
5. Multi-language support (TypeScript, JavaScript, Java)

**Deliverables:**
- `ast-analysis.ts` - Tree-sitter integration
- Semantic dependency graph
- Entity co-usage analysis
- Multi-language vocabulary analysis

**Success Metrics:**
- Accurate entity extraction (no false positives from comments/strings)
- Semantic coupling outperforms token frequency approach
- Multi-language analysis works correctly

---

## Visualization Integration

### New 3D Viewer Features

**1. Coupling Edges**
- Draw lines between coupled files (like current commit highlighting)
- Line thickness = coupling strength (temporal + vocabulary + connascence)
- Line color = coupling type:
  - Blue: Temporal coupling only
  - Green: Vocabulary coupling only
  - Yellow: Connascence of name
  - Red: All three (strongest signal)
- Toggle to show/hide edges
- Slider to filter by minimum coupling strength

**2. Cluster Coloring (New Color Mode)**
- Color files by proposed bounded context
- Each cluster gets distinct color
- Show legend with cluster names (derived from top vocabulary terms)
- User can adjust clustering resolution parameter
- Export/import cluster assignments for iteration

**3. Boundary Violations**
- Highlight files with high cross-cluster coupling (red glow)
- Show "violation count" in file tooltip
- Filter to show only boundary violations
- Help identify files that belong to multiple contexts

**4. Directory Cohesion Overlay**
- Color directory spheres by cohesion score:
  - Green: High cohesion (>0.8) - well-bounded
  - Yellow: Medium cohesion (0.5-0.8) - mixed
  - Red: Low cohesion (<0.5) - multiple contexts or junk drawer
- Show cross-directory coupling edges
- Tooltip shows cohesion score and top coupled directories

**5. Interactive Clustering UI**
- **Cluster Assignment Panel**
  - List all detected clusters with file counts
  - Show top vocabulary terms per cluster
  - User can rename clusters (e.g., "Cluster 1" → "Booking Context")
  - Click cluster to filter/highlight files in 3D view

- **Manual Refinement**
  - Drag files between clusters in UI
  - Recalculate coupling metrics in real-time
  - Show coupling edges that would be "violated" by the move
  - Undo/redo support
  - Export refined cluster assignments to JSON

- **Clustering Parameters**
  - Slider: Coupling strength threshold (0-1)
  - Slider: Clustering resolution (# of clusters)
  - Checkboxes: Enable/disable coupling types (temporal, vocabulary, connascence)
  - Button: Re-run clustering with new parameters

**6. New Color Modes**

**Mode: Coupling Hotspots**
- Color files by total coupling strength (sum of all edges)
- Cool blue → Hot red gradient
- Identify files with highest coupling (potential refactoring candidates)

**Mode: Context Purity**
- Color files by how strongly they belong to their assigned cluster
- Green: High intra-cluster coupling, low inter-cluster coupling (pure)
- Yellow: Mixed coupling (integration layer)
- Red: Low purity (belongs to multiple contexts or wrong cluster)

**Mode: Architectural Violations**
- Color files by number of cross-cluster coupling edges
- Helps identify context boundary violations
- Highlight files that couple to too many different contexts

**7. Coupling Timeline Playback**
- Extend existing timeline mode to show coupling evolution
- Play through commits and watch coupling edges form/break
- Highlight when clusters split or merge
- Identify architectural drift over time

**8. Cluster Drill-Down**
- Click a cluster in legend to focus on those files
- Dim/hide other clusters
- Show internal coupling within cluster
- Show external coupling to other clusters
- Navigate back to full view

**9. Export & Reporting**
- **Coupling Report** - CSV with all file pairs and coupling scores
- **Cluster Assignments** - JSON with file → cluster mapping
- **Boundary Violations** - List of high cross-cluster coupling
- **Vocabulary Report** - Top domain terms per cluster
- **Architectural Recommendations** - AI-generated suggestions

### UI Mockup Concept

```
┌─────────────────────────────────────────────────────────────┐
│ Code Evolution Viz - DDD Bounded Context Analysis          │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Color Mode: [Bounded Contexts ▼]                          │
│                                                             │
│  Coupling Types:  ☑ Temporal  ☑ Vocabulary  ☐ Connascence │
│  Edge Threshold:  [====●═══════] 0.3                       │
│  Cluster Count:   [===●════════] 5                         │
│                                                             │
│  [Re-run Clustering]  [Export Report]                      │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│                   [3D Visualization]                        │
│                                                             │
│          🌍 Directory A         🌍 Directory B             │
│            ╱ ╲                    ╱ ╲                      │
│           🌙 🌙                   🌙 🌙                     │
│                                                             │
│         ~~~~~~~~ Coupling Edge ~~~~~~~~                     │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│ Detected Bounded Contexts:                                 │
│                                                             │
│ 🔵 Booking Context (45 files)                              │
│    booking, reservation, appointment, schedule             │
│                                                             │
│ 🟢 Payment Context (32 files)                              │
│    payment, invoice, transaction, receipt                  │
│                                                             │
│ 🟡 Inventory Context (28 files)                            │
│    inventory, stock, warehouse, fulfillment                │
│                                                             │
│ 🔴 Shared Kernel (12 files)                                │
│    [High cross-cluster coupling - Refactoring candidate]   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## Technical Implementation Details

### Coupling Matrix Data Structure

**Challenge:** React has 6,784 files = 46M possible pairs!

**Solution: Sparse Matrix**
```typescript
// Only store edges with non-zero coupling
interface CouplingEdge {
  fileA: string
  fileB: string
  temporalCoupling: number      // Co-change frequency
  vocabularyCoupling: number    // Vocabulary similarity
  connascenceCoupling: number   // Rename events
  totalCoupling: number         // Weighted sum
}

// Store as edge list, not matrix
const couplingGraph: CouplingEdge[] = []

// Index by file for fast lookups
const fileIndex: Map<string, CouplingEdge[]> = new Map()
```

**Storage Size:**
- React: ~50K significant coupling edges (vs 46M theoretical)
- Gzipped JSON: ~500KB
- Loads instantly in browser

### Clustering Algorithms

**Louvain Method (Recommended):**
- Fast: O(n log n) for sparse graphs
- Hierarchical: Produces nested clusters
- Optimizes modularity (dense intra-cluster, sparse inter-cluster)
- Used by Gephi, NetworkX, igraph

**Implementation:**
```typescript
import { Graph } from 'graphology'
import louvain from 'graphology-communities-louvain'

// Build graph from coupling edges
const graph = new Graph()
for (file of allFiles) {
  graph.addNode(file.path)
}
for (edge of couplingEdges) {
  graph.addEdge(edge.fileA, edge.fileB, { weight: edge.totalCoupling })
}

// Run Louvain clustering
const clusters = louvain(graph, { resolution: 1.0 })
// Returns: Map<node, clusterId>
```

**Alternative Algorithms:**
- **Newman's Modularity Optimization** - What CodeScene uses
- **Hierarchical Clustering** - Produces dendogram
- **Spectral Clustering** - Good for balanced clusters
- **Label Propagation** - Very fast, less deterministic

**Libraries:**
- JavaScript: `graphology-communities-louvain`, `ml-hclust`
- Python: `networkx.community.louvain_communities`, `scikit-learn.SpectralClustering`

### TF-IDF for Domain Term Extraction

**Term Frequency (TF):**
```typescript
// How often term appears in file
tf(term, file) = count(term in file) / total_tokens_in_file
```

**Inverse Document Frequency (IDF):**
```typescript
// How rare term is across all files
idf(term) = log(total_files / files_containing_term)
```

**TF-IDF Score:**
```typescript
tfidf(term, file) = tf(term, file) * idf(term)
```

**High TF-IDF = Distinctive domain term**

**Example:**
- File: `BookingService.ts`
- Tokens: `["booking", "service", "reservation", "create", "booking", "manager"]`

| Term | TF (in file) | IDF (across repo) | TF-IDF | Interpretation |
|------|--------------|-------------------|--------|----------------|
| "booking" | 2/6 = 0.33 | log(1000/50) = 3.0 | 0.99 | **High** - Distinctive domain term |
| "reservation" | 1/6 = 0.17 | log(1000/30) = 3.5 | 0.59 | **High** - Distinctive |
| "service" | 1/6 = 0.17 | log(1000/800) = 0.22 | 0.04 | **Low** - Common technical term |
| "create" | 1/6 = 0.17 | log(1000/500) = 0.69 | 0.12 | **Low** - Generic verb |

**Filter:** Keep terms with TF-IDF > 0.5 → `["booking", "reservation"]`

**Implementation:**
```typescript
import { TfIdf } from 'natural'

const tfidf = new TfIdf()

// Add all files as documents
for (file of allFiles) {
  const tokens = extractIdentifiers(file.content)
  tfidf.addDocument(tokens.join(' '))
}

// Get top terms for a file
tfidf.listTerms(fileIndex).forEach(item => {
  console.log(`${item.term}: ${item.tfidf}`)
})
```

### Git Word-Diff Parsing

**Command:**
```bash
git show --word-diff=porcelain <commit-hash> <file-path>
```

**Output Format:**
```
 function
-MakeBooking
+MakeReservation
 (data) {
~
   const
-booking
+reservation
   = validate(data)
```

**Legend:**
- `~` - Start of new hunk
- ` ` (space) - Unchanged token
- `-` - Removed token
- `+` - Added token

**Parsing Algorithm:**
```typescript
function parseWordDiff(diffOutput: string): Map<string, string> {
  const lines = diffOutput.split('\n')
  const renames = new Map<string, string>()

  let pendingRemoval: string | null = null

  for (const line of lines) {
    if (line === '~') {
      pendingRemoval = null // Reset on new hunk
    } else if (line.startsWith('-')) {
      pendingRemoval = line.substring(1)
    } else if (line.startsWith('+') && pendingRemoval) {
      const added = line.substring(1)
      // Found a rename: pendingRemoval → added
      renames.set(pendingRemoval, added)
      pendingRemoval = null
    } else {
      pendingRemoval = null
    }
  }

  return renames
}
```

**Detecting Consistent Renames:**
```typescript
// For each commit:
const fileRenames = new Map<string, Map<string, string>>()

for (const file of commit.changes.filesModified) {
  const diff = gitShow('--word-diff=porcelain', commit.hash, file)
  fileRenames.set(file, parseWordDiff(diff))
}

// Find renames that appear in multiple files
const consistentRenames = new Map<string, { from: string, to: string, files: string[] }>()

for (const [file1, renames1] of fileRenames) {
  for (const [from, to] of renames1) {
    // Check if same rename appears in other files
    for (const [file2, renames2] of fileRenames) {
      if (file1 !== file2 && renames2.get(from) === to) {
        // Found a consistent rename!
        const key = `${from}->${to}`
        if (!consistentRenames.has(key)) {
          consistentRenames.set(key, { from, to, files: [] })
        }
        consistentRenames.get(key)!.files.push(file1, file2)
      }
    }
  }
}
```

### Performance Optimizations

**1. Incremental Analysis**
- Cache coupling matrix
- Only recompute for new commits
- Store intermediate results

**2. File Filtering**
- Ignore files with <5 commits (noise)
- Ignore test files for vocabulary analysis
- Focus on source files only

**3. Sampling for Large Repos**
- If >10K files, sample top N most-changed files
- Or partition by directory and analyze separately
- Or use time-windowed analysis (last 2 years only)

**4. Parallel Processing**
- Analyze commits in batches
- Parallelize TF-IDF calculation per file
- Use Web Workers in viewer for clustering

**5. Progressive Loading**
- Load coupling data on-demand
- Show clusters first, edges on request
- Lazy-load vocabulary analysis

---

## Output Formats

### Coupling Graph JSON

```json
{
  "format": "coupling-graph-v1",
  "repositoryPath": "/path/to/repo",
  "analysis": {
    "totalCommits": 21078,
    "filesAnalyzed": 6784,
    "couplingEdges": 52341,
    "dateRange": {
      "first": "2013-05-28T17:04:45.000Z",
      "last": "2025-10-20T12:00:00.000Z"
    }
  },
  "nodes": [
    {
      "id": "src/booking/BookingService.ts",
      "path": "src/booking/BookingService.ts",
      "loc": 245,
      "commitCount": 87,
      "vocabulary": ["booking", "reservation", "schedule"],
      "cluster": 1
    }
  ],
  "edges": [
    {
      "source": "src/booking/BookingService.ts",
      "target": "src/booking/BookingController.ts",
      "coupling": {
        "temporal": 0.67,
        "vocabulary": 0.82,
        "connascence": 0.45,
        "total": 0.72
      },
      "coChangeCount": 45,
      "renameEvents": 3
    }
  ],
  "clusters": [
    {
      "id": 1,
      "name": "Booking Context",
      "fileCount": 45,
      "vocabulary": ["booking", "reservation", "appointment", "schedule"],
      "cohesion": 0.84,
      "files": ["src/booking/BookingService.ts", "..."]
    }
  ],
  "directoryCohesion": [
    {
      "path": "src/booking",
      "cohesion": 0.84,
      "internalCoupling": 245,
      "externalCoupling": 38,
      "topCoupledDirectories": [
        { "path": "src/shared", "coupling": 22 },
        { "path": "src/payments", "coupling": 16 }
      ]
    }
  ]
}
```

### Cluster Assignments JSON

```json
{
  "format": "cluster-assignments-v1",
  "repositoryPath": "/path/to/repo",
  "algorithm": "louvain",
  "parameters": {
    "resolution": 1.0,
    "couplingTypes": ["temporal", "vocabulary", "connascence"],
    "minCouplingThreshold": 0.3
  },
  "clusters": [
    {
      "id": 1,
      "name": "Booking Context",
      "files": [
        "src/booking/BookingService.ts",
        "src/booking/BookingController.ts",
        "src/booking/BookingRepository.ts"
      ],
      "vocabulary": {
        "distinctive": ["booking", "reservation", "appointment"],
        "tfidf": { "booking": 0.98, "reservation": 0.87, "appointment": 0.76 }
      },
      "metrics": {
        "fileCount": 45,
        "cohesion": 0.84,
        "avgInternalCoupling": 0.72,
        "avgExternalCoupling": 0.18
      }
    }
  ]
}
```

---

## Related Tools & Research

### Open Source Tools

**1. temporal-coupling (GitHub - shepmaster)**
- URL: https://github.com/shepmaster/temporal-coupling
- Language: Rust
- Approach: Analyzes git commits to find files changed together
- Output: Most modified files, most modified pairs
- Useful for: Understanding the basic algorithm

**2. code-forensics (GitHub - smontanari)**
- URL: https://github.com/smontanari/code-forensics
- Language: JavaScript
- Features: Temporal coupling, complexity trends, commit activity
- Output: Interactive HTML reports with D3.js visualizations
- Useful for: Report generation and visualization ideas

**3. GitNStats**
- URL: https://embeddedartistry.com/blog/2018/06/21/gitnstats-a-git-history-analyzer-to-help-identify-code-hotspots/
- Approach: Combines churn with complexity to identify hotspots
- Useful for: Hotspot detection methodology

**4. hercules (GitHub - src-d)**
- URL: https://github.com/src-d/hercules
- Language: Go
- Features: Advanced git history analytics, burndown charts
- Output: Highly detailed metrics and visualizations
- Useful for: Inspiration for advanced metrics

### Commercial Tools

**1. CodeScene**
- URL: https://codescene.com
- Features:
  - Temporal coupling analysis
  - Complexity trends
  - Team coordination patterns
  - Architectural drift detection
- Approach: Combines git history with static analysis
- Pricing: Enterprise (expensive)
- Useful for: Understanding best-in-class commercial approach

**2. Mono2Micro (IBM Research)**
- URL: https://dl.acm.org/doi/10.1145/3468264.3473915
- Features: Automated monolith decomposition
- Approach: Spatio-temporal analysis + runtime call graphs
- Output: Recommended microservice partitions
- Useful for: Research-grade decomposition algorithms

**3. vFunction**
- URL: https://vfunction.com
- Features: Automated microservice extraction
- Approach: Static + dynamic analysis with ML
- Target: Enterprise Java applications
- Useful for: Industry validation of bounded context detection

### Academic Research

**1. "Microservice Decomposition via Static and Dynamic Analysis" (2020)**
- Authors: Krause, Zirkelbach
- Approach: Combines DDD bounded context pattern with runtime visualization
- Key Insight: Evolutionary analysis reveals hidden dependencies

**2. "Extraction of Microservices from Monolithic Software Architectures" (2017)**
- Authors: Mazlami, Cito
- Approach: Coupling criteria (logical, semantic, contributor)
- Algorithm: Clustering on weighted graph
- Result: Successfully identified service boundaries in real applications

**3. "From Monolithic Systems to Microservices" (2019)**
- Approach: Process mining + git history
- Key Insight: Transaction boundaries indicate context boundaries

**4. "Feature Table Approach to Decomposing Monoliths" (2021)**
- Authors: ArXiv paper
- Approach: VAE + GNN for automated clustering
- Key Insight: ML can learn optimal boundaries from coupling patterns

**5. "Service Cutter: A Systematic Approach to Service Decomposition"**
- 16 coupling criteria from literature and industry
- Structured, repeatable decomposition process
- Open source implementation available

### Key Academic Findings

1. **Temporal coupling is the strongest signal** for architectural relationships
2. **Combining multiple coupling types** (logical, semantic, contributor) improves accuracy
3. **Domain-Driven Design bounded contexts** align with clustering results
4. **Automated approaches** achieve 80-90% agreement with expert manual decomposition
5. **Evolutionary data reveals architectural drift** that static analysis misses

---

## Success Metrics

### Quantitative Metrics

**Clustering Quality:**
- **Modularity Score** - Ratio of intra-cluster to inter-cluster edges (target: >0.5)
- **Silhouette Score** - How well files fit their assigned cluster (target: >0.6)
- **Cohesion Ratio** - Average directory cohesion score (target: >0.7)

**Validation Against Ground Truth:**
- **Directory Alignment** - % of clusters that align with directory structure
- **Known Module Agreement** - % match with documented architecture
- **Developer Validation** - Survey developers on cluster accuracy

**Performance:**
- **Analysis Time** - <1 minute for 10K commits, <5 minutes for 100K commits
- **Viewer Load Time** - <2 seconds for 5K files with coupling graph
- **Clustering Time** - <10 seconds for re-clustering with new parameters

### Qualitative Metrics

**User Feedback:**
- Can developers identify architectural issues?
- Do proposed clusters make sense?
- Are boundary violations actionable?
- Does vocabulary analysis reveal domain language?

**Actionability:**
- Number of refactoring opportunities identified
- Clarity of recommended cluster assignments
- Usefulness of cross-cluster coupling warnings

---

## Future Enhancements

### Short Term

**1. Refactoring Assistant**
- Suggest file moves based on coupling analysis
- Estimate impact of proposed changes
- Track refactoring progress over time

**2. Architectural Drift Detection**
- Baseline coupling patterns at specific commit
- Alert when coupling patterns diverge from baseline
- Track architectural decay metrics

**3. Team Ownership Overlay**
- Combine contributor data with bounded contexts
- Identify knowledge silos (only one person knows a context)
- Suggest team reorganization based on contexts

### Medium Term

**4. Machine Learning Clustering**
- Train on hand-labeled clusters
- Learn repository-specific patterns
- Improve clustering accuracy with feedback

**5. Multi-Repository Analysis**
- Detect bounded contexts across microservices
- Identify shared dependencies
- Recommend service boundary changes

**6. Integration with DDD Tools**
- Export context map in standard format
- Generate skeleton context diagrams
- Integration with EventStorming tools

### Long Term

**7. Real-Time Analysis**
- Watch git repository for changes
- Update coupling analysis incrementally
- Alert on architectural violations in CI/CD

**8. AI-Powered Recommendations**
- Use LLM to analyze commit messages + code
- Generate natural language architecture reports
- Suggest bounded context names based on vocabulary

**9. Collaborative Architecture**
- Multi-user cluster refinement
- Share and compare cluster assignments
- Version control for architecture decisions

---

## Implementation Notes

### File Locations

**Processor (Analysis):**
```
processor/src/
  coupling-analyzer.ts          # Temporal coupling matrix
  vocabulary-analyzer.ts         # TF-IDF and token extraction
  connascence-detector.ts        # Rename detection
  clustering.ts                  # Louvain and other algorithms
  types.ts                       # Add CouplingGraph types
```

**Viewer (Visualization):**
```
viewer/src/
  couplingVisualizer.ts          # Coupling edge rendering
  clusterManager.ts              # Cluster color mode and UI
  boundaryViolations.ts          # Cross-cluster coupling warnings
  colorModeManager.ts            # Add cluster color mode
```

**Output:**
```
processor/output/
  <repo-name>-coupling.json      # Coupling graph
  <repo-name>-clusters.json      # Cluster assignments
  <repo-name>-vocabulary.json    # Vocabulary analysis
```

### Dependencies

**Processor:**
```json
{
  "dependencies": {
    "graphology": "^0.25.0",
    "graphology-communities-louvain": "^2.0.0",
    "natural": "^7.0.7",
    "stopword": "^2.0.0"
  }
}
```

**Viewer:**
```json
{
  "dependencies": {
    "d3-force": "^3.0.0",
    "graphology": "^0.25.0"
  }
}
```

### Testing Strategy

**Unit Tests:**
- Coupling matrix calculation
- TF-IDF scoring
- Rename detection with sample diffs
- Clustering algorithms with known graphs

**Integration Tests:**
- Full analysis on small test repositories
- Known architectural patterns (e.g., hexagonal architecture)
- Validate clusters match expected structure

**Real-World Validation:**
- Analyze React, analyze your own repos
- Compare results with documented architecture
- Survey developers on accuracy

---

## MCP Server Integration

### Vision: Analysis-as-a-Service for Coding Agents

**Problem Statement:**
Current coding agents (Claude Code, GitHub Copilot, Cursor, etc.) lack deep architectural context about the codebases they work with. They can read files and understand local patterns, but they cannot:
- Understand the conceptual contours of the codebase
- Identify bounded context boundaries
- Recommend where new code should be placed based on coupling patterns
- Suggest refactorings that align with the domain model
- Validate naming choices against the ubiquitous language

**Solution: CodeCohesion MCP Server**

Expose the bounded context analysis output as a [Model Context Protocol (MCP)](https://modelcontextprotocol.io) server that coding agents can query to make better architectural decisions.

### MCP Server Capabilities

**1. Context Query Operations**

```typescript
// Query: "What bounded contexts exist in this codebase?"
{
  "method": "resources/list",
  "result": [
    {
      "uri": "codecohesion://contexts",
      "name": "Bounded Contexts",
      "description": "Detected bounded contexts with files and vocabulary",
      "mimeType": "application/json"
    }
  ]
}

// Response:
{
  "contexts": [
    {
      "id": 1,
      "name": "Booking Context",
      "fileCount": 45,
      "vocabulary": ["booking", "reservation", "appointment", "schedule"],
      "cohesion": 0.84,
      "files": ["src/booking/BookingService.ts", ...]
    },
    {
      "id": 2,
      "name": "Payment Context",
      "fileCount": 32,
      "vocabulary": ["payment", "invoice", "transaction", "receipt"],
      "cohesion": 0.76,
      "files": ["src/payments/PaymentService.ts", ...]
    }
  ]
}
```

**2. File Placement Recommendations**

```typescript
// Tool: suggest_file_placement
// Query: "Where should I put a new ReservationCancellation feature?"

{
  "tool": "suggest_file_placement",
  "arguments": {
    "description": "Handle reservation cancellations with refund logic",
    "suggestedName": "ReservationCancellation",
    "keywords": ["reservation", "cancellation", "refund"]
  }
}

// Response:
{
  "recommendations": [
    {
      "context": "Booking Context",
      "confidence": 0.92,
      "reasoning": "Strong vocabulary match: 'reservation' (TF-IDF: 0.87)",
      "suggestedPath": "src/booking/",
      "relatedFiles": [
        "src/booking/ReservationService.ts",
        "src/booking/BookingCancellation.ts"
      ],
      "couplingPrediction": {
        "bookingService": 0.85,
        "paymentService": 0.32
      }
    },
    {
      "context": "Payment Context",
      "confidence": 0.45,
      "reasoning": "Weak match: 'refund' appears but lower TF-IDF (0.43)",
      "warning": "Cross-context coupling likely - consider if refund logic belongs here"
    }
  ]
}
```

**3. Ubiquitous Language Validation**

```typescript
// Tool: validate_naming
// Query: "Is 'CustomerReservation' a good name for this class?"

{
  "tool": "validate_naming",
  "arguments": {
    "proposedName": "CustomerReservation",
    "context": "src/booking/",
    "type": "class"
  }
}

// Response:
{
  "validation": {
    "isConsistent": false,
    "issues": [
      {
        "type": "terminology_conflict",
        "message": "This context uses 'Booking' (87 occurrences), not 'Reservation' (12 occurrences)",
        "suggestion": "Consider 'CustomerBooking' for consistency"
      },
      {
        "type": "synonym_detected",
        "message": "'Reservation' and 'Booking' used interchangeably",
        "files": ["BookingService.ts", "ReservationController.ts"],
        "recommendation": "Standardize on one term across the context"
      }
    ],
    "alternativeNames": [
      {
        "name": "CustomerBooking",
        "confidence": 0.91,
        "reasoning": "Aligns with dominant terminology in Booking Context"
      },
      {
        "name": "BookingForCustomer",
        "confidence": 0.73,
        "reasoning": "Alternative pattern found in existing code"
      }
    ]
  }
}
```

**4. Coupling Impact Analysis**

```typescript
// Tool: analyze_coupling_impact
// Query: "What will be impacted if I change PaymentService?"

{
  "tool": "analyze_coupling_impact",
  "arguments": {
    "filePath": "src/payments/PaymentService.ts"
  }
}

// Response:
{
  "impact": {
    "directCoupling": [
      {
        "file": "src/payments/PaymentController.ts",
        "coupling": 0.89,
        "type": ["temporal", "vocabulary", "connascence"],
        "riskLevel": "high"
      },
      {
        "file": "src/booking/BookingService.ts",
        "coupling": 0.42,
        "type": ["temporal"],
        "riskLevel": "medium",
        "warning": "Cross-context coupling - consider if this is intended"
      }
    ],
    "contextBoundaryViolations": [
      {
        "file": "src/booking/BookingService.ts",
        "context": "Booking Context",
        "suggestion": "High coupling suggests shared concern - consider extracting to Shared Kernel or using domain events"
      }
    ],
    "recommendation": "This file is central to Payment Context. Changes will impact 8 files within context (expected) and 3 files in Booking Context (potential architectural issue)."
  }
}
```

**5. Refactoring Suggestions**

```typescript
// Tool: suggest_refactorings
// Query: "What refactorings would improve this codebase's architecture?"

{
  "tool": "suggest_refactorings",
  "arguments": {
    "scope": "all" // or specific context ID
  }
}

// Response:
{
  "suggestions": [
    {
      "type": "extract_context",
      "priority": "high",
      "description": "Split 'Core Context' into separate bounded contexts",
      "reasoning": "Low cohesion (0.42) suggests multiple concerns",
      "proposedContexts": [
        {
          "name": "User Management Context",
          "files": ["src/core/UserService.ts", "src/core/AuthService.ts"],
          "vocabulary": ["user", "authentication", "authorization"]
        },
        {
          "name": "Notification Context",
          "files": ["src/core/EmailService.ts", "src/core/NotificationService.ts"],
          "vocabulary": ["notification", "email", "alert"]
        }
      ]
    },
    {
      "type": "move_file",
      "priority": "medium",
      "file": "src/booking/PaymentHelper.ts",
      "from": "Booking Context",
      "to": "Payment Context",
      "reasoning": "Strong coupling to Payment Context (0.78) vs Booking Context (0.23)",
      "impact": "Low - only 2 files in Booking Context reference this"
    },
    {
      "type": "standardize_terminology",
      "priority": "medium",
      "context": "Booking Context",
      "issue": "Inconsistent use of 'Booking' vs 'Reservation'",
      "recommendation": "Standardize on 'Booking' (87 vs 12 occurrences)",
      "affectedFiles": 7
    }
  ]
}
```

**6. Architectural Guardrails**

```typescript
// Tool: validate_change
// Query: "Should I add an import from PaymentService to InventoryService?"

{
  "tool": "validate_change",
  "arguments": {
    "type": "add_import",
    "from": "src/inventory/InventoryService.ts",
    "to": "src/payments/PaymentService.ts"
  }
}

// Response:
{
  "allowed": false,
  "severity": "error",
  "reason": "Cross-context coupling violation",
  "explanation": "Payment Context and Inventory Context have no existing coupling (0.0). This would introduce a new architectural dependency.",
  "alternatives": [
    {
      "approach": "Domain Events",
      "description": "Use event-driven communication instead of direct coupling",
      "example": "InventoryService publishes 'StockReserved' event, PaymentService subscribes"
    },
    {
      "approach": "Anti-Corruption Layer",
      "description": "Introduce an adapter in Inventory Context that translates Payment concepts",
      "example": "Create PaymentAdapter in Inventory Context to isolate dependency"
    },
    {
      "approach": "Shared Kernel",
      "description": "Extract shared payment primitives to a Shared Kernel context",
      "example": "Move Money, Currency to shared/ and reference from both contexts"
    }
  ]
}
```

### MCP Server Architecture

**Implementation Overview:**

```typescript
// processor/src/mcp-server.ts

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CouplingGraph, ClusterAssignments } from "./types.js";

export class CodeCohesionMCPServer {
  private server: Server;
  private couplingData: CouplingGraph;
  private clusters: ClusterAssignments;

  constructor(couplingDataPath: string, clustersPath: string) {
    this.couplingData = loadCouplingGraph(couplingDataPath);
    this.clusters = loadClusters(clustersPath);

    this.server = new Server(
      {
        name: "codecohesion",
        version: "1.0.0",
      },
      {
        capabilities: {
          resources: {},
          tools: {},
        },
      }
    );

    this.setupHandlers();
  }

  private setupHandlers() {
    // Resource: List bounded contexts
    this.server.setRequestHandler("resources/list", async () => ({
      resources: [
        {
          uri: "codecohesion://contexts",
          name: "Bounded Contexts",
          description: "Detected bounded contexts with files and vocabulary",
          mimeType: "application/json",
        },
      ],
    }));

    // Resource: Read context details
    this.server.setRequestHandler("resources/read", async (request) => {
      if (request.params.uri === "codecohesion://contexts") {
        return {
          contents: [
            {
              uri: "codecohesion://contexts",
              mimeType: "application/json",
              text: JSON.stringify(this.clusters.clusters, null, 2),
            },
          ],
        };
      }
      throw new Error("Unknown resource");
    });

    // Tool: Suggest file placement
    this.server.setRequestHandler("tools/call", async (request) => {
      const { name, arguments: args } = request.params;

      switch (name) {
        case "suggest_file_placement":
          return this.suggestFilePlacement(args);
        case "validate_naming":
          return this.validateNaming(args);
        case "analyze_coupling_impact":
          return this.analyzeCouplingImpact(args);
        case "suggest_refactorings":
          return this.suggestRefactorings(args);
        case "validate_change":
          return this.validateChange(args);
        default:
          throw new Error(`Unknown tool: ${name}`);
      }
    });

    // Tool discovery
    this.server.setRequestHandler("tools/list", async () => ({
      tools: [
        {
          name: "suggest_file_placement",
          description: "Recommend which bounded context a new feature should be placed in",
          inputSchema: {
            type: "object",
            properties: {
              description: { type: "string" },
              suggestedName: { type: "string" },
              keywords: { type: "array", items: { type: "string" } },
            },
            required: ["description"],
          },
        },
        {
          name: "validate_naming",
          description: "Validate if a proposed name is consistent with the ubiquitous language",
          inputSchema: {
            type: "object",
            properties: {
              proposedName: { type: "string" },
              context: { type: "string" },
              type: { type: "string", enum: ["class", "method", "variable", "file"] },
            },
            required: ["proposedName"],
          },
        },
        // ... other tools
      ],
    }));
  }

  private suggestFilePlacement(args: any) {
    // Implementation using coupling data and vocabulary analysis
    const { description, suggestedName, keywords } = args;

    // Extract terms from description and suggestedName
    const terms = extractTerms(description + " " + suggestedName);

    // Calculate vocabulary similarity with each cluster
    const recommendations = this.clusters.clusters.map(cluster => {
      const vocabularySimilarity = calculateSimilarity(
        terms,
        cluster.vocabulary.distinctive
      );

      return {
        context: cluster.name,
        confidence: vocabularySimilarity,
        reasoning: generateReasoning(terms, cluster),
        suggestedPath: getSuggestedPath(cluster),
        relatedFiles: getRelatedFiles(cluster, terms),
      };
    }).sort((a, b) => b.confidence - a.confidence);

    return { recommendations };
  }

  private validateNaming(args: any) {
    // Implementation using vocabulary consistency analysis
    // ... (similar pattern)
  }

  async start() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error("CodeCohesion MCP server running on stdio");
  }
}

// Start server
const server = new CodeCohesionMCPServer(
  process.argv[2], // coupling-graph.json path
  process.argv[3]  // cluster-assignments.json path
);

server.start().catch(console.error);
```

### Integration with Coding Agents

**Claude Code Integration:**

```json
// Claude Code config: ~/.config/claude-code/mcp.json
{
  "mcpServers": {
    "codecohesion": {
      "command": "node",
      "args": [
        "/path/to/codecohesion/processor/dist/mcp-server.js",
        "/path/to/project/codecohesion-coupling.json",
        "/path/to/project/codecohesion-clusters.json"
      ]
    }
  }
}
```

**Usage Example:**

```
User: "I need to add a feature for customers to cancel their bookings and get refunds"

Claude Code (with MCP):
1. Calls suggest_file_placement with description
2. Receives recommendation: "Booking Context (92% confidence)"
3. Calls validate_naming for "BookingCancellation"
4. Receives: "Consistent with ubiquitous language"
5. Creates src/booking/BookingCancellation.ts
6. Calls validate_change to check coupling to PaymentService
7. Receives warning about cross-context coupling
8. Suggests: "Use domain events instead of direct dependency"

Response: "I'll create the cancellation feature in the Booking Context at
src/booking/BookingCancellation.ts. I notice this will need to trigger refunds,
which couples to the Payment Context. I recommend using domain events
(BookingCancelled event) instead of directly importing PaymentService to
maintain bounded context isolation."
```

### Benefits for Developers

**1. Context-Aware Code Placement**
- Agents suggest the right location for new code based on coupling patterns
- Reduces architectural drift by respecting bounded context boundaries

**2. Terminology Consistency**
- Agents validate naming against the ubiquitous language
- Catch terminology conflicts early (e.g., "Order" meaning different things in different contexts)

**3. Architectural Guardrails**
- Agents warn about cross-context coupling violations
- Suggest architectural patterns (events, ACL, shared kernel) instead of tight coupling

**4. Refactoring Guidance**
- Agents proactively suggest refactorings to improve cohesion
- Identify files in the wrong context based on coupling analysis

**5. Informed Design Decisions**
- Agents understand which changes will have wide impact
- Recommend splitting or merging contexts based on coupling evolution

### MCP Server Deployment Options

**Option 1: Per-Project Server**
- Run analysis once, generate JSON files
- Start MCP server pointing to project-specific analysis
- Lightweight, no re-analysis needed

**Option 2: Watch Mode Server**
- MCP server watches git repository for changes
- Incrementally updates coupling analysis
- Always up-to-date, higher resource usage

**Option 3: Cloud-Hosted Service**
- Centralized MCP server for organization
- Analyze all repositories, expose via MCP protocol
- Team-wide architectural insights

### Future Enhancements

**1. Multi-Repository Context Maps**
- Detect bounded contexts across microservices
- MCP server provides cross-repo architectural guidance

**2. AI-Powered Architecture Recommendations**
- Use LLM to analyze coupling patterns + commit messages
- Generate natural language architectural reports
- Explain "why" certain coupling patterns exist

**3. Team Collaboration**
- Multiple developers' coding agents query same MCP server
- Shared architectural decisions
- Version control for context boundaries

**4. CI/CD Integration**
- MCP server validates architectural rules in pull requests
- Fail builds that violate bounded context isolation
- Generate architecture violation reports

## Conclusion

This vision document outlines a comprehensive approach to bounded context detection using git history, semantic analysis, and visual exploration. The approach is:

**✅ Feasible** - Building on existing capabilities and proven algorithms
**✅ Incremental** - Phased implementation with value at each stage
**✅ Validated** - Grounded in academic research and commercial tools
**✅ Novel** - Interactive 3D visualization is unique
**✅ Valuable** - Solves real problems in DDD and microservices
**✅ Agent-Ready** - MCP server integration empowers coding agents with architectural context

The combination of temporal coupling, vocabulary analysis, and connascence of name detection provides multiple complementary signals for identifying bounded contexts. The interactive 3D visualization makes the analysis explorable and actionable. The MCP server integration makes the insights available to coding agents, enabling them to make better architectural decisions in real-time.

**Next Steps:**
1. Review and refine this vision with stakeholders
2. Prioritize phases based on value and complexity
3. Spike Phase 1 (temporal coupling) to validate approach
4. Prototype MCP server with basic context query capabilities
5. Test integration with Claude Code for architectural guidance
6. Iterate based on feedback from real-world usage

---

## References

### Tools
- [temporal-coupling](https://github.com/shepmaster/temporal-coupling) - Open source git coupling analyzer
- [code-forensics](https://github.com/smontanari/code-forensics) - Git history analysis toolkit
- [CodeScene](https://codescene.com) - Commercial code analysis platform
- [tree-sitter](https://tree-sitter.github.io/tree-sitter/) - Multi-language parser
- [graphology](https://graphology.github.io/) - JavaScript graph library

### Research Papers
- "Microservice Decomposition via Static and Dynamic Analysis" (2020)
- "Extraction of Microservices from Monolithic Software Architectures" (2017)
- "Mono2Micro: A Practical Tool for Decomposing Monoliths" (2021)
- "Feature Table Approach to Decomposing Monoliths" (2021)

### Documentation
- [CodeScene Temporal Coupling Docs](https://docs.enterprise.codescene.io/guides/technical/temporal-coupling.html)
- [Tree-Sitter Documentation](https://tree-sitter.github.io/tree-sitter/)
- [Louvain Method (Wikipedia)](https://en.wikipedia.org/wiki/Louvain_method)

### Blog Posts
- [Analyzing code base through GIT history](https://kariera.future-processing.pl/blog/analyzing-code-base-through-git-history/)
- [Software (r)Evolution - CodeScene Blog](https://codescene.com/blog/software-revolution-part3/)
- [Connascence - Alchemists](https://alchemists.io/articles/connascence)

---

**Document Version:** 1.0
**Last Updated:** 2025-10-20
**Author:** Research conducted with assistance from Claude (Anthropic)
**Status:** Vision / Planning Phase
