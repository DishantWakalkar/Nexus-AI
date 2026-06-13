import re
from dataclasses import dataclass


@dataclass
class Chunk:
    doc_id: str
    source: str
    title: str
    content: str
    chunk_index: int
    metadata: dict


class RecursiveChunker:
    """
    Splits documents into chunks respecting semantic boundaries.
    Priority: split on headings → paragraphs → sentences → characters.
    This preserves meaning better than fixed-size splitting.
    """

    def __init__(self, chunk_size: int = 512, chunk_overlap: int = 64):
        self.chunk_size = chunk_size
        self.chunk_overlap = chunk_overlap

    def chunk_document(self, doc: dict) -> list[Chunk]:
        """Split a document dict into a list of Chunk objects."""
        content = doc["content"].strip()
        if not content:
            return []

        raw_chunks = self._split(content)
        # Remove empty chunks and deduplicate
        raw_chunks = [c.strip() for c in raw_chunks if c.strip()]

        chunks = []
        for i, chunk_text in enumerate(raw_chunks):
            chunks.append(Chunk(
                doc_id=doc["doc_id"],
                source=doc["source"],
                title=doc["title"],
                content=chunk_text,
                chunk_index=i,
                metadata={
                    **doc.get("metadata", {}),
                    "title": doc["title"],
                    "chunk_index": i,
                    "total_chunks": len(raw_chunks),
                    "url": doc.get("url", ""),
                }
            ))
        return chunks

    def _split(self, text: str) -> list[str]:
        """Recursively split text using semantic boundaries."""
        if len(text) <= self.chunk_size:
            return [text]

        # Try splitting on headings first
        heading_splits = re.split(r'\n(?=##\s)', text)
        if len(heading_splits) > 1:
            return self._merge_splits(heading_splits)

        # Then double newlines (paragraph breaks)
        para_splits = re.split(r'\n\n+', text)
        if len(para_splits) > 1:
            return self._merge_splits(para_splits)

        # Then single newlines
        line_splits = text.split('\n')
        if len(line_splits) > 1:
            return self._merge_splits(line_splits)

        # Then sentences
        sentence_splits = re.split(r'(?<=[.!?])\s+', text)
        if len(sentence_splits) > 1:
            return self._merge_splits(sentence_splits)

        # Last resort — hard split by character with overlap
        return self._hard_split(text)

    def _merge_splits(self, splits: list[str]) -> list[str]:
        """
        Merge small splits together up to chunk_size,
        with overlap between chunks to preserve context.
        """
        chunks = []
        current = ""

        for split in splits:
            split = split.strip()
            if not split:
                continue

            if len(current) + len(split) + 1 <= self.chunk_size:
                current = f"{current}\n{split}".strip()
            else:
                if current:
                    chunks.append(current)
                # Start new chunk with overlap from previous
                if current and self.chunk_overlap > 0:
                    overlap_text = current[-self.chunk_overlap:]
                    current = f"{overlap_text}\n{split}".strip()
                else:
                    current = split

        if current:
            chunks.append(current)

        return chunks

    def _hard_split(self, text: str) -> list[str]:
        """Hard split by character count when no other boundary works."""
        chunks = []
        start = 0
        while start < len(text):
            end = start + self.chunk_size
            chunks.append(text[start:end])
            start = end - self.chunk_overlap
        return chunks