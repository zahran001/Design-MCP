# Chakra UI Code Block Exploration Report

**Generated:** 2025-10-15
**Components Analyzed:** 7
**Purpose:** Inform code block extraction and filtering strategy for Week 1

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [HTML Structure Patterns](#html-structure-patterns)
3. [Heading Detection Strategies](#heading-detection-strategies)
4. [Code Block Classifications](#code-block-classifications)
5. [Component-by-Component Analysis](#component-by-component-analysis)
6. [Recommendations](#recommendations)

---

## Executive Summary

- **Total code blocks found:** 118
- **Average per component:** 16.9
- **Components with errors:** 0

## HTML Structure Patterns

### Consistent Patterns Found

**DOM Hierarchy:**
```
<div>
  └─ <pre>
      └─ <code>
```

### Parent Element Analysis

| Parent Tag | Count | Percentage |
|------------|-------|------------|
| `<div>` | 35 | 100.0% |

### Class and Data Attributes

- **`<pre>` classes:** Present
- **`<code>` classes:** Present
- **Data attributes:** Not found

## Heading Detection Strategies

### Success Rates

- **Success rate:** 40.0% (14/35)
- **Failed to find heading:** 21 blocks

### Detection Methods Used

| Method | Count | Percentage |
|--------|-------|------------|
| parent-search | 14 | 100.0% |

### Common Section Headings

| Heading | Occurrences |
|---------|-------------|
| .css-vfo6uh{color:var(--chakra-colors-fg);-webkit-text-decoration:underline;text-decoration:underline;text-underline-offset:3px;text-decoration-thickness:2px;text-decoration-color:var(--chakra-colors-border-emphasized);font-weight:500;}Usage | 12 |
| Usage | 2 |

## Code Block Classifications

### Distribution

| Classification | Count | Percentage |
|----------------|-------|------------|
| COMPONENT_EXAMPLE (JSX, MULTI_COMPONENT) | 9 | 25.7% |
| IMPORT_STATEMENT | 7 | 20.0% |
| COMPONENT_EXAMPLE (JSX, PROPS, MULTI_COMPONENT) | 6 | 17.1% |
| COMPONENT_EXAMPLE (JSX) | 4 | 11.4% |
| UNKNOWN | 4 | 11.4% |
| BARE_JSX | 3 | 8.6% |
| COMPONENT_EXAMPLE (JSX, PROPS) | 2 | 5.7% |

### Low-Value Code Blocks (Candidates for Filtering)

**Total low-value blocks:** 10 (28.6%)

These should be filtered out:
- **IMPORT_STATEMENT:** 7 occurrences
- **BARE_JSX:** 3 occurrences

### High-Value Code Blocks (Keep These)

**Total high-value blocks:** 21 (60.0%)

Component example breakdown:
- With props: 8
- With hooks: 0
- Multiple components: 15
- With event handlers: 0

## Component-by-Component Analysis

### Button

- **Category:** core
- **URL:** https://chakra-ui.com/docs/components/button
- **Total code blocks:** 18
- **Analyzed blocks:** 5

**Section headings (top 10):**
- **h1:** Button
  - **h2:** .css-vfo6uh{color:var(--chakra-colors-fg);-webkit-text-decoration:underline;text-decoration:underline;text-underline-offset:3px;text-decoration-thickness:2px;text-decoration-color:var(--chakra-colors-border-emphasized);font-weight:500;}Usage (id="usage")
  - **h2:** Examples (id="examples")
    - **h3:** Sizes (id="sizes")
    - **h3:** Variants (id="variants")
    - **h3:** Icon (id="icon")
    - **h3:** Color (id="color")
    - **h3:** Disabled (id="disabled")
    - **h3:** Disabled Link (id="disabled-link")
    - **h3:** Loading (id="loading")

**Sample code blocks:**

**Block 1:** COMPONENT_EXAMPLE (JSX)
- Lines: 5
- Components used: Button

```
import { Button } from "@chakra-ui/react"

const Demo = () => {
  return <Button>Button</Button>
}
```

**Block 2:** IMPORT_STATEMENT
- Section: ".css-vfo6uh{color:var(--chakra-colors-fg);-webkit-text-decoration:underline;text-decoration:underline;text-underline-offset:3px;text-decoration-thickness:2px;text-decoration-color:var(--chakra-colors-border-emphasized);font-weight:500;}Usage"
- Lines: 1

```
import { Button, ButtonGroup } from "@chakra-ui/react"
```

**Block 3:** BARE_JSX
- Section: ".css-vfo6uh{color:var(--chakra-colors-fg);-webkit-text-decoration:underline;text-decoration:underline;text-underline-offset:3px;text-decoration-thickness:2px;text-decoration-color:var(--chakra-colors-border-emphasized);font-weight:500;}Usage"
- Lines: 1
- Components used: Button

```
<Button>Click me</Button>
```

---

### Input

- **Category:** core
- **URL:** https://chakra-ui.com/docs/components/input
- **Total code blocks:** 27
- **Analyzed blocks:** 5

**Section headings (top 10):**
- **h1:** Input
  - **h2:** .css-vfo6uh{color:var(--chakra-colors-fg);-webkit-text-decoration:underline;text-decoration:underline;text-underline-offset:3px;text-decoration-thickness:2px;text-decoration-color:var(--chakra-colors-border-emphasized);font-weight:500;}Usage (id="usage")
  - **h2:** Examples (id="examples")
    - **h3:** Variants (id="variants")
    - **h3:** Sizes (id="sizes")
    - **h3:** Helper Text (id="helper-text")
    - **h3:** Error Text (id="error-text")
    - **h3:** Field (id="field")
    - **h3:** Hook Form (id="hook-form")
    - **h3:** Element (id="element")

**Sample code blocks:**

**Block 1:** COMPONENT_EXAMPLE (JSX)
- Lines: 5
- Components used: Input

```
import { Input } from "@chakra-ui/react"

const Demo = () => {
  return <Input placeholder="Enter your email" />
}
```

**Block 2:** IMPORT_STATEMENT
- Section: ".css-vfo6uh{color:var(--chakra-colors-fg);-webkit-text-decoration:underline;text-decoration:underline;text-underline-offset:3px;text-decoration-thickness:2px;text-decoration-color:var(--chakra-colors-border-emphasized);font-weight:500;}Usage"
- Lines: 1

```
import { Input } from "@chakra-ui/react"
```

**Block 3:** BARE_JSX
- Section: ".css-vfo6uh{color:var(--chakra-colors-fg);-webkit-text-decoration:underline;text-decoration:underline;text-underline-offset:3px;text-decoration-thickness:2px;text-decoration-color:var(--chakra-colors-border-emphasized);font-weight:500;}Usage"
- Lines: 1
- Components used: Input

```
<Input />
```

---

### Box

- **Category:** core
- **URL:** https://chakra-ui.com/docs/components/box
- **Total code blocks:** 9
- **Analyzed blocks:** 5

**Section headings (top 10):**
- **h1:** Box
  - **h2:** .css-vfo6uh{color:var(--chakra-colors-fg);-webkit-text-decoration:underline;text-decoration:underline;text-underline-offset:3px;text-decoration-thickness:2px;text-decoration-color:var(--chakra-colors-border-emphasized);font-weight:500;}Usage (id="usage")
  - **h2:** Examples (id="examples")
    - **h3:** Shorthand (id="shorthand")
    - **h3:** Pseudo Props (id="pseudo-props")
    - **h3:** Border (id="border")
    - **h3:** As Prop (id="as-prop")
    - **h3:** Shadow (id="shadow")
    - **h3:** Composition (id="composition")
  - **h2:** Props (id="props")

**Sample code blocks:**

**Block 1:** COMPONENT_EXAMPLE (JSX)
- Lines: 9
- Components used: Box

```
import { Box } from "@chakra-ui/react"

const Demo = () => {
  return (
    <Box background="tomato" width="100%" padding="4" color="white">
... (4 more lines)
```

**Block 2:** IMPORT_STATEMENT
- Section: ".css-vfo6uh{color:var(--chakra-colors-fg);-webkit-text-decoration:underline;text-decoration:underline;text-underline-offset:3px;text-decoration-thickness:2px;text-decoration-color:var(--chakra-colors-border-emphasized);font-weight:500;}Usage"
- Lines: 1

```
import { Box } from "@chakra-ui/react"
```

**Block 3:** BARE_JSX
- Section: ".css-vfo6uh{color:var(--chakra-colors-fg);-webkit-text-decoration:underline;text-decoration:underline;text-underline-offset:3px;text-decoration-thickness:2px;text-decoration-color:var(--chakra-colors-border-emphasized);font-weight:500;}Usage"
- Lines: 1
- Components used: Box

```
<Box />
```

---

### Dialog

- **Category:** overlay
- **URL:** https://chakra-ui.com/docs/components/dialog
- **Total code blocks:** 21
- **Analyzed blocks:** 5

**Section headings (top 10):**
- **h1:** Dialog
  - **h2:** Usage (id="usage")
  - **h2:** Examples (id="examples")
    - **h3:** Sizes (id="sizes")
    - **h3:** Cover (id="cover")
    - **h3:** Fullscreen (id="fullscreen")
    - **h3:** Responsive Size (id="responsive-size")
    - **h3:** Placement (id="placement")
    - **h3:** Controlled (id="controlled")
    - **h3:** Store (id="store")

**Sample code blocks:**

**Block 1:** COMPONENT_EXAMPLE (JSX, MULTI_COMPONENT)
- Lines: 38
- Components used: Button, CloseButton, Dialog, Portal

```
import { Button, CloseButton, Dialog, Portal } from "@chakra-ui/react"

const Demo = () => {
  return (
    <Dialog.Root>
... (33 more lines)
```

**Block 2:** IMPORT_STATEMENT
- Section: ".css-vfo6uh{color:var(--chakra-colors-fg);-webkit-text-decoration:underline;text-decoration:underline;text-underline-offset:3px;text-decoration-thickness:2px;text-decoration-color:var(--chakra-colors-border-emphasized);font-weight:500;}Usage"
- Lines: 1

```
import { Dialog } from "@chakra-ui/react"
```

**Block 3:** UNKNOWN
- Section: ".css-vfo6uh{color:var(--chakra-colors-fg);-webkit-text-decoration:underline;text-decoration:underline;text-underline-offset:3px;text-decoration-thickness:2px;text-decoration-color:var(--chakra-colors-border-emphasized);font-weight:500;}Usage"
- Lines: 14
- Components used: Dialog

```
<Dialog.Root>
  <Dialog.Trigger />
  <Dialog.Backdrop />
  <Dialog.Positioner>
    <Dialog.Content>
... (9 more lines)
```

---

### Select

- **Category:** form
- **URL:** https://chakra-ui.com/docs/components/select
- **Total code blocks:** 23
- **Analyzed blocks:** 5

**Section headings (top 10):**
- **h1:** Select
  - **h2:** Usage (id="usage")
  - **h2:** Examples (id="examples")
    - **h3:** Sizes (id="sizes")
    - **h3:** Variants (id="variants")
    - **h3:** Option Group (id="option-group")
    - **h3:** Controlled (id="controlled")
    - **h3:** Async Loading (id="async-loading")
    - **h3:** Hook Form (id="hook-form")
    - **h3:** Disabled (id="disabled")

**Sample code blocks:**

**Block 1:** COMPONENT_EXAMPLE (JSX, PROPS, MULTI_COMPONENT)
- Lines: 41
- Components used: Portal, Select

```
"use client"

import { Portal, Select, createListCollection } from "@chakra-ui/react"

const Demo = () => {
... (36 more lines)
```

**Block 2:** IMPORT_STATEMENT
- Section: ".css-vfo6uh{color:var(--chakra-colors-fg);-webkit-text-decoration:underline;text-decoration:underline;text-underline-offset:3px;text-decoration-thickness:2px;text-decoration-color:var(--chakra-colors-border-emphasized);font-weight:500;}Usage"
- Lines: 1

```
import { Select } from "@chakra-ui/react"
```

**Block 3:** UNKNOWN
- Section: ".css-vfo6uh{color:var(--chakra-colors-fg);-webkit-text-decoration:underline;text-decoration:underline;text-underline-offset:3px;text-decoration-thickness:2px;text-decoration-color:var(--chakra-colors-border-emphasized);font-weight:500;}Usage"
- Lines: 25
- Components used: Select

```
<Select.Root>
  <Select.HiddenSelect />
  <Select.Label />

  <Select.Control>
... (20 more lines)
```

---

### Skeleton

- **Category:** feedback
- **URL:** https://chakra-ui.com/docs/components/skeleton
- **Total code blocks:** 9
- **Analyzed blocks:** 5

**Section headings (top 10):**
- **h1:** Skeleton
  - **h2:** Usage (id="usage")
  - **h2:** Examples (id="examples")
    - **h3:** Feed (id="feed")
    - **h3:** Text (id="text")
    - **h3:** With Children (id="with-children")
    - **h3:** Variants (id="variants")
    - **h3:** Content Loading (id="content-loading")
    - **h3:** Start and End Color (id="start-and-end-color")
  - **h2:** Props (id="props")

**Sample code blocks:**

**Block 1:** COMPONENT_EXAMPLE (JSX, MULTI_COMPONENT)
- Lines: 13
- Components used: HStack, Skeleton, SkeletonCircle, Stack

```
import { HStack, Skeleton, SkeletonCircle, Stack } from "@chakra-ui/react"

const Demo = () => {
  return (
    <HStack gap="5">
... (8 more lines)
```

**Block 2:** IMPORT_STATEMENT
- Section: "Usage"
- Lines: 1

```
import { Skeleton, SkeletonCircle, SkeletonText } from "@chakra-ui/react"
```

**Block 3:** UNKNOWN
- Section: "Usage"
- Lines: 7
- Components used: HStack, Skeleton, SkeletonCircle, SkeletonText, Stack

```
<Stack gap="6" maxW="xs">
  <HStack width="full">
    <SkeletonCircle size="10" />
    <SkeletonText noOfLines={2} />
  </HStack>
... (2 more lines)
```

---

### Stat

- **Category:** data-display
- **URL:** https://chakra-ui.com/docs/components/stat
- **Total code blocks:** 11
- **Analyzed blocks:** 5

**Section headings (top 10):**
- **h1:** Stat
  - **h2:** .css-vfo6uh{color:var(--chakra-colors-fg);-webkit-text-decoration:underline;text-decoration:underline;text-underline-offset:3px;text-decoration-thickness:2px;text-decoration-color:var(--chakra-colors-border-emphasized);font-weight:500;}Usage (id="usage")
  - **h2:** Examples (id="examples")
    - **h3:** Format Options (id="format-options")
    - **h3:** Indicator (id="indicator")
    - **h3:** Info Tip (id="info-tip")
    - **h3:** Value Unit (id="value-unit")
    - **h3:** Progress Bar (id="progress-bar")
    - **h3:** Icon (id="icon")
    - **h3:** Trend (id="trend")

**Sample code blocks:**

**Block 1:** COMPONENT_EXAMPLE (JSX, MULTI_COMPONENT)
- Lines: 10
- Components used: Stat

```
import { Stat } from "@chakra-ui/react"

const Demo = () => {
  return (
    <Stat.Root>
... (5 more lines)
```

**Block 2:** IMPORT_STATEMENT
- Section: ".css-vfo6uh{color:var(--chakra-colors-fg);-webkit-text-decoration:underline;text-decoration:underline;text-underline-offset:3px;text-decoration-thickness:2px;text-decoration-color:var(--chakra-colors-border-emphasized);font-weight:500;}Usage"
- Lines: 1

```
import { Stat } from "@chakra-ui/react"
```

**Block 3:** UNKNOWN
- Section: ".css-vfo6uh{color:var(--chakra-colors-fg);-webkit-text-decoration:underline;text-decoration:underline;text-underline-offset:3px;text-decoration-thickness:2px;text-decoration-color:var(--chakra-colors-border-emphasized);font-weight:500;}Usage"
- Lines: 6
- Components used: Stat

```
<Stat.Root>
  <Stat.Label />
  <Stat.ValueText />
  <Stat.HelpText />
  <Stat.UpIndicator />
... (1 more lines)
```

---

## Recommendations

Based on the exploration findings, here are the recommended strategies:

### 1. HTML Selectors

```typescript
// Reliable selector for code blocks
const codeBlocks = page.locator('main pre code');

// Parent wrapper (if needed)
// Most common parent: <div>
```

### 2. Heading Detection Strategy

**Primary method:** parent-search (100.0% success)

```typescript
// Recommended approach: Try sibling walk first, fallback to parent search
async function findPrecedingHeading(codeBlock: Locator) {
  // Method 1: Walk backwards through siblings (up to 20 elements)
  // Method 2: Walk up parent tree and search backwards
  // Return null if not found
}
```

### 3. Section-Based Filtering

**Sections to skip (low-value code):**
- "Installation" (found 0 times)
- "Import" (found 0 times)
- "Setup" (found 0 times)
- "Getting Started" (found 0 times)
- "Prerequisites" (found 0 times)

### 4. Content Heuristics

**Filter out:**
- Installation commands (0 found)
- Import statements < 3 lines (7 found)
- Package.json snippets (0 found)
- Config files (0 found)

**Keep:**
- Component examples with props (8 found)
- Examples with hooks (0 found)
- Multi-component compositions (15 found)
- Examples with event handlers (0 found)

### 5. Expected Filtering Impact

**Before filtering:** 35 code blocks
**After filtering:** ~21 code blocks (28.6% reduction)

This aligns with the Week 1 goal: **8-15 high-quality examples per component**

---

## Next Steps

1. Implement `extractCodeExamples()` function using findings
2. Implement section-based filtering
3. Implement content heuristics
4. Implement composition scoring (threshold ≥5)
5. Test on 5-10 pages and validate output quality
