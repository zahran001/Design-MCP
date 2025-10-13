/**
 * Utility functions for processing and chunking text content
 */

export interface ChunkOptions {
  maxChunkSize?: number;
  overlap?: number;
  preserveParagraphs?: boolean;
}

/**
 * Splits text into smaller chunks while trying to preserve semantic meaning
 */
export function chunkText(text: string, options: ChunkOptions = {}): string[] {
  const {
    maxChunkSize = 1000,
    overlap = 100,
    preserveParagraphs = true,
  } = options;

  // TODO: Implement intelligent text chunking
  // This is a placeholder implementation
  if (text.length <= maxChunkSize) {
    return [text];
  }

  const chunks: string[] = [];
  let currentIndex = 0;

  while (currentIndex < text.length) {
    let chunkEnd = Math.min(currentIndex + maxChunkSize, text.length);

    // If we need to preserve paragraphs, try to break at paragraph boundaries
    if (preserveParagraphs) {
      const nextParagraph = text.indexOf('\n\n', chunkEnd - overlap);
      if (nextParagraph !== -1 && nextParagraph < chunkEnd + overlap) {
        chunkEnd = nextParagraph;
      }
    }

    chunks.push(text.slice(currentIndex, chunkEnd).trim());
    currentIndex = chunkEnd - overlap;
  }

  return chunks;
}

/**
 * Removes unnecessary whitespace and normalizes text
 */
export function normalizeText(text: string): string {
  return text
    .replace(/\s+/g, ' ')
    .replace(/[\n\r]+/g, '\n')
    .trim();
}

/**
 * Extracts code blocks from text content
 */
export function extractCodeBlocks(text: string): { code: string; language: string }[] {
  // TODO: Implement code block extraction
  // This is a placeholder implementation
  return [];
}