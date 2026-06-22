# Comprehensive Search Logging Demo

This document shows exactly what you'll see when running `npm run search "How do I size a button?"` with the new logging system.

## Expected Output

```
══════════════════════════════════════════════════════════════════════════
🔍 SEARCH REQUEST
══════════════════════════════════════════════════════════════════════════

📍 USER_QUERY
   query: "How do I size a button?"
   length: 25
   words: 5

══════════════════════════════════════════════════════════════════════════
📊 EMBEDDING_QUERY
══════════════════════════════════════════════════════════════════════════

📍 EMBEDDING_QUERY
   vectorLength: 1536
   vectorDimension: "1536-dimensional"
   vectorSample: "[0.0142, -0.0389, 0.0512, 0.0187, -0.0234, ...]"
   model: "text-embedding-3-small"
   vectorMagnitude: "12.4567"

══════════════════════════════════════════════════════════════════════════
📊 SEARCH_EXECUTION
══════════════════════════════════════════════════════════════════════════

📍 SEARCH_EXECUTION
   collection: "chakra-ui-docs"
   limit: 5
   timeTaken: "45.23ms"

══════════════════════════════════════════════════════════════════════════
📊 TOP-K RESULTS (5 Most Similar Chunks)
══════════════════════════════════════════════════════════════════════════
  [1] Score: 0.921 │ Button │ button-example-sizing-v1
  [2] Score: 0.891 │ Button │ button-example-variants-v1
  [3] Score: 0.867 │ Button │ button-example-colors-v1
  [4] Score: 0.723 │ Button │ button-example-loading-v1
  [5] Score: 0.681 │ Button │ button-example-disabled-v1
══════════════════════════════════════════════════════════════════════════

══════════════════════════════════════════════════════════════════════════
📦 RETRIEVED PAYLOADS
══════════════════════════════════════════════════════════════════════════

──────────────────────────────────────────────────────────────────────────
📄 RESULT [1]: button-example-sizing-v1
──────────────────────────────────────────────────────────────────────────
Component: Button
Source: https://chakra-ui.com/docs/components/button

Explanation:
This example demonstrates how to control Button dimensions using the size
prop, showing 5 available size options (xs, sm, md, lg, xl)...

Code:
import { Button, HStack } from "@chakra-ui/react"

const Demo = () => {
  return (
    <HStack wrap="wrap" gap="6">
      <Button size="xs">Button (xs)</Button>
      ...

──────────────────────────────────────────────────────────────────────────
📄 RESULT [2]: button-example-variants-v1
──────────────────────────────────────────────────────────────────────────
Component: Button
Source: https://chakra-ui.com/docs/components/button

Explanation:
This example shows how to render Button with different visual variants
(solid, outline, ghost, link). Each variant conveys different semantic...

Code:
import { Button, VStack } from "@chakra-ui/react"

const Demo = () => {
  return (
    <VStack spacing={4}>
      <Button colorScheme="blue">Solid</Button>
      ...

──────────────────────────────────────────────────────────────────────────
📄 RESULT [3]: button-example-colors-v1
──────────────────────────────────────────────────────────────────────────
Component: Button
Source: https://chakra-ui.com/docs/components/button

Explanation:
This example demonstrates how to style Button components using the
colorScheme prop, which controls both background and text colors...

Code:
import { Button, HStack } from "@chakra-ui/react"

const Demo = () => {
  return (
    <HStack gap={4}>
      <Button colorScheme="red">Red Button</Button>
      ...

──────────────────────────────────────────────────────────────────────────
📄 RESULT [4]: button-example-loading-v1
──────────────────────────────────────────────────────────────────────────
Component: Button
Source: https://chakra-ui.com/docs/components/button

Explanation:
This example shows how to add loading state to a Button using the isLoading
prop combined with a spinner, useful for async operations...

Code:
import { Button, Spinner } from "@chakra-ui/react"

const Demo = () => {
  return (
    <Button isLoading loadingText="Loading">
      Click me
    </Button>
      ...

──────────────────────────────────────────────────────────────────────────
📄 RESULT [5]: button-example-disabled-v1
──────────────────────────────────────────────────────────────────────────
Component: Button
Source: https://chakra-ui.com/docs/components/button

Explanation:
This example demonstrates how to disable a Button component using the
isDisabled prop, which prevents user interaction and shows visual feedback...

Code:
import { Button } from "@chakra-ui/react"

const Demo = () => {
  return (
    <Button isDisabled>
      Disabled Button
    </Button>
      ...

══════════════════════════════════════════════════════════════════════════
✅ FINAL ANSWER (from QDRANT)
══════════════════════════════════════════════════════════════════════════
[1] Component: Button (Score: 0.921)
Chunk: button-example-sizing-v1
This example demonstrates how to control Button dimensions using the size...

[2] Component: Button (Score: 0.891)
Chunk: button-example-variants-v1
This example shows how to render Button with different visual variants...

[3] Component: Button (Score: 0.867)
Chunk: button-example-colors-v1
This example demonstrates how to style Button components using the...

[4] Component: Button (Score: 0.723)
Chunk: button-example-loading-v1
This example shows how to add loading state to a Button using the isLoading...

[5] Component: Button (Score: 0.681)
Chunk: button-example-disabled-v1
This example demonstrates how to disable a Button component using the...

══════════════════════════════════════════════════════════════════════════
📋 EXECUTION SUMMARY
══════════════════════════════════════════════════════════════════════════
Total Time: 287ms
Stages Executed: 5
Stages: USER_QUERY → EMBEDDING_QUERY → SEARCH_EXECUTION → TOP_K_RESULTS → FINAL_ANSWER
══════════════════════════════════════════════════════════════════════════

💾 Full execution logs (JSON):
{
  "summary": {
    "totalTime": 287,
    "stageCount": 5,
    "stages": [
      "USER_QUERY",
      "EMBEDDING_QUERY",
      "SEARCH_EXECUTION",
      "TOP_K_RESULTS",
      "FINAL_ANSWER"
    ],
    "logs": [
      {
        "timestamp": "2025-12-27T14:32:45.123Z",
        "stage": "USER_QUERY",
        "data": {
          "query": "How do I size a button?",
          "length": 25,
          "words": 5
        }
      },
      {
        "timestamp": "2025-12-27T14:32:45.156Z",
        "stage": "EMBEDDING_QUERY",
        "data": {
          "vectorLength": 1536,
          "vectorDimension": 1536,
          "vectorSample": [0.0142, -0.0389, 0.0512, 0.0187, -0.0234],
          "model": "text-embedding-3-small",
          "vectorMagnitude": 12.456789
        }
      },
      {
        "timestamp": "2025-12-27T14:32:45.201Z",
        "stage": "SEARCH_EXECUTION",
        "data": {
          "collection": "chakra-ui-docs",
          "limit": 5,
          "timeTaken": 45.23
        }
      },
      {
        "timestamp": "2025-12-27T14:32:45.202Z",
        "stage": "TOP_K_RESULTS",
        "data": {
          "totalResults": 5,
          "results": [
            {
              "rank": 1,
              "id": "button-example-sizing-v1",
              "score": "0.921",
              "chunkType": "code-example",
              "componentName": "Button"
            },
            {
              "rank": 2,
              "id": "button-example-variants-v1",
              "score": "0.891",
              "chunkType": "code-example",
              "componentName": "Button"
            },
            {
              "rank": 3,
              "id": "button-example-colors-v1",
              "score": "0.867",
              "chunkType": "code-example",
              "componentName": "Button"
            },
            {
              "rank": 4,
              "id": "button-example-loading-v1",
              "score": "0.723",
              "chunkType": "code-example",
              "componentName": "Button"
            },
            {
              "rank": 5,
              "id": "button-example-disabled-v1",
              "score": "0.681",
              "chunkType": "code-example",
              "componentName": "Button"
            }
          ]
        }
      },
      {
        "timestamp": "2025-12-27T14:32:45.203Z",
        "stage": "FINAL_ANSWER",
        "data": {
          "source": "qdrant",
          "answerLength": 487,
          "answerPreview": "[1] Component: Button (Score: 0.921)\nChunk: button-example-sizing-v1\nThis example demonstrates how to control Button dimensions using the size..."
        }
      }
    ]
  }
}
```

---

## What This Logging Captures

### 1. **User Question**
- The exact query string
- Query length in characters
- Word count

### 2. **Query Embedding Vector**
- Vector length: 1536 dimensions
- Sample values (first 5 floats)
- Model used: `text-embedding-3-small`
- Vector magnitude (for quality metrics)

### 3. **Top-K Results**
- Rank (1-5)
- Cosine similarity score (0.0-1.0)
- Chunk ID
- Component name

### 4. **Retrieved Payload**
- For each result:
  - Component name
  - Source URL
  - Explanation text (first 150 chars)
  - Code snippet (first 100 chars)

### 5. **Final Answer**
- Formatted summary of all results
- Source indicator (qdrant or llm)
- Answer preview

### 6. **Execution Summary**
- Total time (milliseconds)
- Number of stages executed
- Stage sequence

### 7. **Full JSON Export**
- Complete structured logs
- Machine-readable format
- Timestamped entries

---

## How to Use This Logging

### Run a Search Query
```bash
npm run build
npm run search "How do I size a button?"
```

### You'll See
1. **Console output** with formatted sections
2. **Step-by-step visibility** of each stage
3. **Execution metrics** (timing, vector dimensions, scores)
4. **Full JSON logs** at the end for programmatic analysis

### For Debugging
```bash
# Pipe output to file
npm run search "query" > search-results.log 2>&1

# Extract just the JSON logs (last section)
npm run search "query" | tail -100 | grep -A 1000 "Full execution logs"
```

### For Integration with LLM
```typescript
// When you build GenerationService, you can:
const searchResult = await retrieval.searchDetailed(query);
const context = JSON.stringify(searchResult, null, 2);
// Pass context to Claude for grounded answers
```

---

## Logging Files Created/Modified

| File | Purpose |
|------|---------|
| `src/utils/searchLogger.ts` | Core logging utility (NEW) |
| `src/services/RetrievalService.ts` | Added `searchDetailed()` method (UPDATED) |
| `src/steps/3-search/retriever.ts` | Integrated logging throughout (UPDATED) |

---

## Next Steps

1. **Test the logging** with sample queries
2. **Review JSON output** structure
3. **Use logging for debugging** if results don't match expectations
4. **Pass logging data to LLM** when implementing GenerationService

---

## Feature: JSON Export for Debugging

All logs are exported as JSON at the end of execution. This allows you to:

- **Programmatically analyze** search behavior
- **Debug embeddings** by examining vector samples
- **Track performance** metrics across queries
- **Export for analysis** in external tools

Save logs to file:
```bash
npm run search "query" | grep -A 10000 "Full execution logs" > logs.json
```

Then analyze:
```javascript
const logs = JSON.parse(fs.readFileSync('logs.json'));
console.log('Query:', logs.summary.logs[0].data.query);
console.log('Top score:', logs.summary.logs[3].data.results[0].score);
console.log('Total time:', logs.summary.totalTime, 'ms');
```

---

## Summary

The new logging system provides **complete visibility** into:
- ✅ What you asked
- ✅ How it was embedded (vector length, model)
- ✅ What was retrieved (IDs, scores, payloads)
- ✅ How long it took (milliseconds)
- ✅ Full machine-readable logs (JSON)

Perfect for **debugging, monitoring, and understanding** your RAG pipeline.
