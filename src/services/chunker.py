import ast
import hashlib
import logging
from dataclasses import dataclass, field
from typing import Any, Dict, List

logger = logging.getLogger(__name__)

@dataclass
class CodeFile:
    """
    Represents a code file loaded from a repository.
    """
    file_path: str
    content: str
    language: str
    metadata: Dict[str, Any] = field(default_factory=dict)

@dataclass
class Chunk:
    """
    Represents a logical chunk of a code file (e.g. class, function, or entire file).
    """
    chunk_id: str
    file_path: str
    content: str
    chunk_type: str  # "class", "function", or "file"
    metadata: Dict[str, Any] = field(default_factory=dict)


class CodeChunker:
    """
    Handles chunking of CodeFile objects into smaller logical code chunks.
    For Python files, it extracts classes and functions as individual chunks.
    For unsupported languages or parsing failures, it falls back to file-level chunks.
    """

    def chunk_file(self, code_file: CodeFile) -> List[Chunk]:
        """
        Chunks a given CodeFile object based on its language and contents.
        
        Args:
            code_file: The CodeFile object to chunk.
            
        Returns:
            A list of Chunk objects.
        """
        if not code_file.content or not code_file.content.strip():
            logger.info("Empty code file content for: %s", code_file.file_path)
            return [self._create_file_chunk(code_file, "file")]

        if code_file.language.lower() == "python":
            try:
                return self._chunk_python_file(code_file)
            except Exception as e:
                logger.warning(
                    "Python parsing failed for %s (falling back to file-level chunk): %s", 
                    code_file.file_path, 
                    e
                )
                return [self._create_file_chunk(code_file, "file")]
        else:
            # Fall back to file-level chunk for other/unsupported languages
            return [self._create_file_chunk(code_file, "file")]

    def _create_file_chunk(self, code_file: CodeFile, chunk_type: str) -> Chunk:
        """Helper to create a standard file-level chunk."""
        chunk_id = self._generate_chunk_id(code_file.file_path, chunk_type, code_file.content)
        
        # Merge original metadata with any extra chunk metadata
        merged_metadata = dict(code_file.metadata)
        merged_metadata.update({
            "chunk_type": chunk_type,
            "start_line": 1,
            "end_line": len(code_file.content.splitlines()) if code_file.content else 1
        })
        
        return Chunk(
            chunk_id=chunk_id,
            file_path=code_file.file_path,
            content=code_file.content,
            chunk_type=chunk_type,
            metadata=merged_metadata
        )

    def _generate_chunk_id(self, file_path: str, chunk_type: str, content: str) -> str:
        """Generates a unique, stable SHA-256 hash for the chunk."""
        hasher = hashlib.sha256()
        hasher.update(file_path.encode("utf-8"))
        hasher.update(chunk_type.encode("utf-8"))
        hasher.update(content.encode("utf-8"))
        return hasher.hexdigest()

    def _chunk_python_file(self, code_file: CodeFile) -> List[Chunk]:
        """Parses a Python file using AST and extracts classes and functions as chunks."""
        tree = ast.parse(code_file.content)
        lines = code_file.content.splitlines()
        chunks: List[Chunk] = []

        # We scan for top-level ClassDef, FunctionDef, and AsyncFunctionDef
        for node in tree.body:
            if isinstance(node, (ast.ClassDef, ast.FunctionDef, ast.AsyncFunctionDef)):
                # Extract text lines for this node
                # Note: lineno in Python is 1-indexed.
                # end_lineno in Python 3.8+ is 1-indexed.
                start_line = node.lineno
                
                # If there are decorators, start from the first decorator's line
                if hasattr(node, "decorator_list") and node.decorator_list:
                    dec_linenos = [dec.lineno for dec in node.decorator_list if hasattr(dec, "lineno")]
                    if dec_linenos:
                        start_line = min(start_line, min(dec_linenos))
                
                end_line = getattr(node, "end_lineno", len(lines))
                
                # Retrieve the lines corresponding to the definition
                # lines are 0-indexed, so we do start_line - 1 to end_line
                node_lines = lines[start_line - 1 : end_line]
                node_content = "\n".join(node_lines)


                chunk_type = "class" if isinstance(node, ast.ClassDef) else "function"
                
                chunk_id = self._generate_chunk_id(code_file.file_path, chunk_type, node_content)
                
                # Merge metadata
                merged_metadata = dict(code_file.metadata)
                merged_metadata.update({
                    "name": node.name,
                    "chunk_type": chunk_type,
                    "start_line": start_line,
                    "end_line": end_line
                })
                
                chunks.append(Chunk(
                    chunk_id=chunk_id,
                    file_path=code_file.file_path,
                    content=node_content,
                    chunk_type=chunk_type,
                    metadata=merged_metadata
                ))

        # If no classes or functions were found in Python code, fall back to file-level chunk
        if not chunks:
            logger.info("No classes or functions found in Python file %s, returning file chunk.", code_file.file_path)
            return [self._create_file_chunk(code_file, "file")]

        return chunks
