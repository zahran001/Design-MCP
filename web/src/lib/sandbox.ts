// Turn one generated TSX component into a runnable Sandpack file set.
//
// The generation prompt asks for a single self-contained component importing only
// from "@chakra-ui/react"/"react", but the EXPORT shape varies run to run (default
// export, named export, or no export at all). We normalise that so a fixed App
// entry can always mount it inside a ChakraProvider.

export interface PreviewFiles {
  files: Record<string, string>;
  dependencies: Record<string, string>;
}

/** Find a default export, a named component export, or an undeclared component. */
function resolveEntry(code: string): { code: string; importLine: string } {
  // Case A — already has a default export: import it as default.
  if (/\bexport\s+default\b/.test(code)) {
    return { code, importLine: "import Component from './Component';" };
  }

  // Case B — a named export of a PascalCase binding: import that name.
  const namedExport =
    code.match(/\bexport\s+(?:function|const|class)\s+([A-Z]\w*)/)?.[1] ??
    code.match(/\bexport\s*\{\s*([A-Z]\w*)/)?.[1];
  if (namedExport) {
    return { code, importLine: `import { ${namedExport} as Component } from './Component';` };
  }

  // Case C — no export at all. Pick the last top-level PascalCase declaration
  // (the main component is conventionally defined after any helpers) and append
  // a default export for it.
  const decls = [...code.matchAll(/\b(?:function|const)\s+([A-Z]\w*)/g)].map((m) => m[1]);
  const name = decls[decls.length - 1];
  if (name) {
    return {
      code: `${code}\n\nexport default ${name};\n`,
      importLine: "import Component from './Component';",
    };
  }

  // No component we can identify — let Sandpack surface the failure honestly.
  return { code, importLine: "import Component from './Component';" };
}

export function buildPreviewFiles(component: string): PreviewFiles {
  const { code, importLine } = resolveEntry(component);

  // App entry mounts the component in a v3 ChakraProvider, matching the design
  // system the generation targets.
  const appTsx = `${importLine}
import { ChakraProvider, defaultSystem, Box } from '@chakra-ui/react';

export default function App() {
  return (
    <ChakraProvider value={defaultSystem}>
      <Box p={6}>
        <Component />
      </Box>
    </ChakraProvider>
  );
}
`;

  return {
    files: {
      '/Component.tsx': code,
      '/App.tsx': appTsx,
    },
    // Pin Chakra to the same major the pipeline validates against; @emotion/react
    // is Chakra v3's styling peer.
    dependencies: {
      '@chakra-ui/react': '3.27.1',
      '@emotion/react': '^11.13.0',
    },
  };
}
