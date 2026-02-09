# Multi-RAG-Store Search System - Implementation Documentation

## Overview

This implementation provides a robust multi-source search system that queries multiple RAG stores in parallel, aggregates evidence, and synthesizes comprehensive answers using LLM-based answer generation.

## Architecture

### System Flow

```
User Query → Store Selection → Parallel Retrieval → Aggregation → Synthesis → Display
```

1. **Store Selection**: Users select one or more knowledge sources (projects)
2. **Parallel Retrieval**: Each store is queried independently and simultaneously
3. **Aggregation**: Results are merged with clear source identifiers
4. **Synthesis**: Combined context is passed to LLM for final answer generation
5. **Display**: Answer shown with per-source citations and transparency

### Key Components

#### 1. API Route: `/api/search/multi-store`
**Location**: `src/app/api/search/multi-store/route.ts`

**Responsibilities**:
- Validate incoming requests (query, store names)
- Orchestrate parallel retrieval from multiple stores
- Aggregate chunks with source identifiers
- Synthesize final answer using combined context
- Return structured response with stats and citations

**Request Schema**:
```typescript
{
  query: string;              // User's search query
  storeNames: string[];       // Array of RAG store names to search
  timeout?: number;           // Optional timeout per store (default: 30000ms)
}
```

**Response Schema**:
```typescript
{
  answer: string;                         // Synthesized answer
  storeStats: StoreRetrievalStats[];      // Per-store retrieval status
  aggregatedChunks: AggregatedChunk[];    // All retrieved evidence
  totalChunks: number;                    // Total number of chunks
  error?: string;                         // Error message if any
}
```

#### 2. Search Page UI
**Location**: `src/app/search/page.tsx`

**Features**:
- **Store Selector**: Multi-select checkboxes with "Select All" functionality
- **Real-time Validation**: Prevents search with no stores selected
- **Loading States**: Clear progress indicators during search
- **Error Handling**: Graceful degradation with retry options
- **Result Display**: Hierarchical view of answer, stats, and evidence

**State Management**:
```typescript
- availableStores: RAGStoreOption[]     // All available sources
- selectedStores: Set<string>            // User-selected stores
- isSearching: boolean                   // Search in progress
- searchResult: MultiStoreSearchResult   // Search results
- isLoadingStores: boolean               // Loading sources
- storesError: string | null             // Store loading error
```

#### 3. Type Definitions
**Location**: `src/types.ts`

**New Types**:
- `RAGStoreOption`: Store metadata for UI display
- `AggregatedChunk`: Evidence chunk with source identifier
- `StoreRetrievalStats`: Per-store retrieval metrics
- `MultiStoreSearchResult`: Complete search response

#### 4. UI Components
**New Components**:
- `Checkbox`: Radix UI checkbox component (`src/components/ui/checkbox.tsx`)
- `StoreStatCard`: Display individual store retrieval status
- `AnswerDisplay`: Render answer with citation highlighting

## Implementation Details

### Parallel Retrieval Strategy

```typescript
const retrievalPromises = storeNames.map(async (storeName) => {
    try {
        const result = await Promise.race([
            fileSearch(storeName, retrievalQuery),
            new Promise<never>((_, reject) => 
                setTimeout(() => reject(new Error('Timeout')), timeout)
            )
        ]);
        return { storeName, success: true, result, error: null };
    } catch (error) {
        return { storeName, success: false, result: null, error: error.message };
    }
});

const retrievalResults = await Promise.all(retrievalPromises);
```

**Key Points**:
- Each store is queried in parallel using `Promise.all`
- Individual timeouts prevent slow stores from blocking others
- Failures are isolated - one store failure doesn't fail the entire search
- All results (success/failure) are collected before synthesis

### Context Aggregation

Evidence from all sources is structured with clear identifiers:

```typescript
const contextByStore = storeStats
    .filter(s => s.success && s.chunkCount > 0)
    .map(stat => {
        const storeChunks = aggregatedChunks.filter(c => c.storeName === stat.storeName);
        const chunksText = storeChunks
            .map((chunk, idx) => 
                `[${stat.storeDisplayName} - Chunk ${idx + 1}] (from: ${docInfo})\n${chunk.text}`
            )
            .join('\n\n');
        
        return `=== Source: ${stat.storeDisplayName} (${stat.chunkCount} chunks) ===\n${chunksText}`;
    })
    .join('\n\n');
```

### Synthesis Prompt Engineering

The synthesis prompt is carefully structured to:
1. Provide clear context about the task
2. Include all evidence with source labels
3. Instruct LLM to cite sources using `[Source: Name]` format
4. Handle conflicting information gracefully
5. Acknowledge missing information

### Error Handling Strategy

#### 1. **Store-Level Errors** (Isolated)
- Individual store failures don't crash the search
- Failed stores are tracked with error messages
- Success/failure stats displayed to user
- Partial results still presented if any stores succeed

#### 2. **Request-Level Errors** (Validation)
- Empty query → Rejected with 400
- No stores selected → Rejected with 400
- Invalid store names → Rejected with 400

#### 3. **Timeout Handling**
- Per-store timeout prevents indefinite waiting
- Timeout treated as retrieval failure for that store
- Other stores continue processing

#### 4. **UI Error States**
- Store loading failure: Retry button provided
- Search failure: Clear error message with details
- No results: User-friendly messaging
- Network errors: Graceful degradation

### Performance Optimizations

#### 1. **Parallel Execution**
```typescript
// ✓ GOOD: All stores queried simultaneously
const results = await Promise.all(storePromises);

// ✗ BAD: Sequential queries
for (const store of stores) {
    await queryStore(store); // Slow!
}
```

#### 2. **Timeout Strategy**
- Default 30s per store (configurable)
- Prevents slow stores from blocking UI
- User can retry with different timeout

#### 3. **Result Caching**
- Search results cached in component state
- No re-fetch on re-render
- Clear cache on new search

#### 4. **Chunk Filtering**
- Empty chunks filtered out early
- Metadata files excluded from results
- Only first 10 chunks displayed (with count of remaining)

## Scalability Considerations

### Current Limitations

1. **Store Count**: Optimal for 2-10 stores
   - **Issue**: Too many parallel requests may hit API rate limits
   - **Mitigation**: Consider batching for >10 stores

2. **Chunk Volume**: Limited by LLM context window
   - **Issue**: Many stores × many chunks = large context
   - **Mitigation**: Currently using top chunks; could add ranking

3. **Response Time**: Linear with slowest store
   - **Issue**: One slow store delays entire response
   - **Mitigation**: Timeout handling in place

### Scaling Strategies

#### Short-term (Current Scale: <20 stores)
- ✓ Parallel execution implemented
- ✓ Timeout handling in place
- ✓ Chunk filtering active
- Consider: Add chunk ranking/reranking

#### Medium-term (20-100 stores)
- Implement store batching (e.g., 10 at a time)
- Add result pagination
- Implement smart chunk selection (top-k per store)
- Consider caching frequently accessed stores

#### Long-term (100+ stores)
- Consider separate indexing layer
- Implement query routing (only query relevant stores)
- Add distributed caching
- Consider streaming results as they arrive

## Trust & Explainability Features

### 1. **Source Transparency**
- Every chunk labeled with source name
- Document names preserved in evidence
- Clear separation of sources in UI

### 2. **Retrieval Stats**
- Per-store success/failure status
- Chunk count per source
- Error messages for failed retrievals

### 3. **Citation System**
```
Answer: "The deadline is next Friday [Source: ProjectAlpha]. 
However, the budget was set at $50k [Source: ProjectBeta]."
```

### 4. **Evidence Display**
- Full list of retrieved chunks available
- Source badges on each chunk
- Document names preserved

### 5. **Error Visibility**
- Failed stores clearly marked
- Partial results clearly labeled
- No silent failures

## Usage Example

### Step 1: User selects sources
```
☑ Project Alpha
☑ Project Beta  
☐ Project Gamma
```

### Step 2: User enters query
```
"What are the key milestones across all projects?"
```

### Step 3: System retrieves in parallel
```
Project Alpha: 5 chunks retrieved ✓
Project Beta:  3 chunks retrieved ✓
```

### Step 4: System synthesizes answer
```
Answer: The key milestones are:
1. MVP launch on March 1st [Source: Project Alpha]
2. User testing phase in April [Source: Project Beta]  
3. Final release in June [Source: Project Alpha]
```

### Step 5: Evidence displayed
```
Retrieved Evidence (8 chunks):

[Project Alpha] (from: meeting-2026-01-15.txt)
"We discussed the MVP timeline and agreed on March 1st..."

[Project Beta] (from: planning-notes.txt)  
"User testing will begin in April after initial feedback..."
```

## Testing Recommendations

### Unit Tests
- Store selection logic
- Chunk aggregation
- Error handling paths
- Citation parsing

### Integration Tests
- Multi-store retrieval
- Timeout behavior
- Partial failure scenarios
- Empty result handling

### E2E Tests
- Full search flow
- Store selection UI
- Result display
- Error recovery

### Performance Tests
- Response time with varying store counts
- Timeout effectiveness
- Large result set handling
- Concurrent search requests

## Monitoring & Observability

### Key Metrics to Track

1. **Search Performance**
   - Average response time
   - P95/P99 latencies
   - Timeout rate per store

2. **Retrieval Quality**
   - Average chunks per store
   - Success rate per store
   - Empty result rate

3. **User Behavior**
   - Average stores selected
   - Query length distribution
   - Retry rate

### Logging Strategy

Current logging in place:
```typescript
console.log("Multi-store search received:", { storeCount, queryLength });
console.log(`Store ${displayName}: ${chunkCount} chunks retrieved`);
console.warn(`Store ${displayName}: retrieval failed - ${error}`);
```

Recommended additions:
- Timing metrics (start/end per store)
- Cache hit rates (if implemented)
- User interaction events
- Error categorization

## Future Enhancements

### High Priority
1. **Chunk Reranking**: Score and rerank chunks before synthesis
2. **Streaming Results**: Show results as they arrive
3. **Query Suggestions**: Auto-suggest based on available content

### Medium Priority
1. **Store Grouping**: Allow users to create store groups
2. **Search History**: Save and recall previous searches
3. **Export Results**: Download search results as PDF/markdown

### Low Priority
1. **Advanced Filters**: Date range, document type, etc.
2. **Semantic Clustering**: Group similar chunks
3. **Multi-language Support**: Handle queries in multiple languages

## Conclusion

This implementation provides a production-ready multi-RAG-store search system with:
- ✓ Parallel retrieval for performance
- ✓ Comprehensive error handling
- ✓ Clear source attribution
- ✓ Scalable architecture
- ✓ User-friendly interface

The system is optimized for clarity, trust, and explainability while maintaining good performance characteristics for typical workloads (2-10 stores, <50 chunks total).
