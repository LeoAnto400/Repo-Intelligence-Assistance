import os
import shutil
import subprocess
import tempfile
from pathlib import Path
from typing import Any, Dict, List, Optional

SUPPORTED_EXTENSIONS: Dict[str, str] = {
    ".py": "Python",
    ".js": "JavaScript",
    ".jsx": "JavaScript React",
    ".ts": "TypeScript",
    ".tsx": "TypeScript React",
    ".html": "HTML",
    ".css": "CSS",
    ".md": "Markdown",
    ".json": "JSON",
    ".yaml": "YAML",
    ".yml": "YAML",
    ".sh": "Shell",
    ".go": "Go",
    ".rs": "Rust",
    ".java": "Java",
    ".cpp": "C++",
    ".c": "C",
    ".h": "C/C++ Header",
    ".cs": "C#",
    ".txt": "Text"
}

IGNORE_DIRS = {
    ".git", 
    "node_modules", 
    "build", 
    "dist", 
    "venv", 
    ".venv", 
    "pycache", 
    "__pycache__"
}

class GitHubService:
    """
    Handles cloning GitHub repositories locally, scanning their directories,
    filtering for supported source files, and extracting file contents and metadata.
    """
    
    def __init__(self, token: Optional[str] = None):
        """
        Initialize the GitHub service with an optional access token for auth/rate limits.
        
        Args:
            token: GitHub personal access token (optional).
        """
        self.token = token

    def fetch_repo_files(self, repo_url: str) -> List[Dict[str, Any]]:
        """
        Clones a GitHub repository into a temporary workspace within the project,
        scans the files, and extracts path, language, and content metadata.
        
        Args:
            repo_url: Full HTTP URL to the GitHub repository.
            
        Returns:
            List of dicts, each containing:
                - "path": Relative path from the repository root
                - "language": Inferred language based on file extension
                - "content": Decoded UTF-8 content of the file
                
        Raises:
            ValueError: If the repository URL is empty or invalid.
            RuntimeError: If cloning or reading files fails.
        """
        if not repo_url or not repo_url.strip():
            raise ValueError("Repository URL cannot be empty.")

        # Ensure temp directory exists inside workspace root to adhere to constraints
        workspace_root = os.getcwd()
        temp_base_dir = os.path.join(workspace_root, ".temp_clones")
        os.makedirs(temp_base_dir, exist_ok=True)

        # Build authenticated clone URL if token is present
        clone_url = repo_url
        if self.token:
            # Handle token injection for HTTP clone URLs
            if repo_url.startswith("https://github.com/"):
                clone_url = repo_url.replace("https://github.com/", f"https://x-access-token:{self.token}@github.com/")

        results: List[Dict[str, Any]] = []

        # Create temporary directory inside workspace root
        with tempfile.TemporaryDirectory(dir=temp_base_dir) as temp_dir:
            try:
                # Execute git clone
                # Use --depth 1 to minimize download size and speed up ingestion
                subprocess.run(
                    ["git", "clone", "--depth", "1", clone_url, temp_dir],
                    check=True,
                    stdout=subprocess.PIPE,
                    stderr=subprocess.PIPE,
                    text=True
                )
            except subprocess.CalledProcessError as e:
                # Clean up and re-raise clear error
                err_msg = e.stderr or e.stdout or str(e)
                raise RuntimeError(f"Failed to clone repository: {err_msg}") from e

            # Scan files inside temporary repository directory
            temp_path = Path(temp_dir)
            for root, dirs, files in os.walk(temp_dir):
                # Filter out ignore directories in place to prevent visiting
                dirs[:] = [d for d in dirs if d not in IGNORE_DIRS]

                for file in files:
                    file_path = Path(root) / file
                    ext = file_path.suffix.lower()

                    if ext in SUPPORTED_EXTENSIONS:
                        lang = SUPPORTED_EXTENSIONS[ext]
                        # Calculate path relative to the clone directory root
                        rel_path = file_path.relative_to(temp_path).as_posix()
                        
                        try:
                            # Read content; ignore decoding errors for non-UTF8/binary edge cases
                            content = file_path.read_text(encoding="utf-8", errors="ignore")
                            results.append({
                                "path": rel_path,
                                "language": lang,
                                "content": content
                            })
                        except Exception as e:
                            # Log/capture or continue if a specific file fails to read
                            # For safety, we will skip files that cannot be read
                            continue

        return results

    def chunk_file_content(self, file_content: str, chunk_size: int = 1000, chunk_overlap: int = 200) -> List[str]:
        """
        Splits source code/file contents into smaller overlapping chunks suitable for embedding.
        
        Args:
            file_content: Raw contents of a code file.
            chunk_size: Target character size of chunks.
            chunk_overlap: Overlapping size between subsequent chunks.
            
        Returns:
            List of chunked substrings.
        """
        if chunk_size <= 0:
            raise ValueError("chunk_size must be positive.")
        if chunk_overlap < 0:
            raise ValueError("chunk_overlap cannot be negative.")
        if chunk_overlap >= chunk_size:
            raise ValueError("chunk_overlap must be less than chunk_size.")

        chunks = []
        start = 0
        content_len = len(file_content)

        if content_len == 0:
            return []

        while start < content_len:
            end = start + chunk_size
            chunks.append(file_content[start:end])
            start += chunk_size - chunk_overlap

        return chunks
