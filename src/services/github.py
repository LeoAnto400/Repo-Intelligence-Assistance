import logging
import os
import shutil
import subprocess
import tempfile
from pathlib import Path
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)

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

def safe_rmtree(path: str) -> None:
    """
    Safely remove directory tree, handling Windows read-only file permission issues (e.g. from .git).
    """
    try:
        shutil.rmtree(path)
    except Exception:
        try:
            import stat
            def _handle_readonly(func, p, exc_info):
                try:
                    os.chmod(p, stat.S_IWRITE)
                    func(p)
                except Exception:
                    pass
            shutil.rmtree(path, onerror=_handle_readonly)
        except Exception as e:
            logger.warning("Failed to safely remove directory %s: %s", path, e)

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

    def clone_repository(self, repo_url: str) -> str:
        """
        Clones a GitHub repository from a URL into a temporary workspace within the project.
        
        Args:
            repo_url: Full HTTP URL to the GitHub repository.
            
        Returns:
            The absolute local path to the cloned repository.
            
        Raises:
            ValueError: If the repository URL is empty or invalid.
            RuntimeError: If cloning fails.
        """
        if not repo_url or not repo_url.strip():
            logger.error("Repository URL is empty or invalid.")
            raise ValueError("Repository URL cannot be empty.")

        # Ensure temp directory exists inside workspace root to adhere to constraints
        workspace_root = os.getcwd()
        temp_base_dir = os.path.join(workspace_root, ".temp_clones")
        try:
            os.makedirs(temp_base_dir, exist_ok=True)
        except Exception as e:
            logger.exception("Failed to create temporary base directory %s", temp_base_dir)
            raise RuntimeError(f"Failed to initialize temporary workspace directory: {e}") from e

        # Build authenticated clone URL if token is present
        clone_url = repo_url.strip()
        if self.token:
            # Handle token injection for HTTP clone URLs
            if clone_url.startswith("https://github.com/"):
                clone_url = clone_url.replace("https://github.com/", f"https://x-access-token:{self.token}@github.com/")
            elif clone_url.startswith("http://github.com/"):
                clone_url = clone_url.replace("http://github.com/", f"http://x-access-token:{self.token}@github.com/")

        # Create a unique temporary directory inside the temp base directory
        try:
            temp_dir = tempfile.mkdtemp(dir=temp_base_dir)
            logger.info("Created temporary workspace directory for cloning: %s", temp_dir)
        except Exception as e:
            logger.exception("Failed to create temporary directory for clone")
            raise RuntimeError(f"Failed to create temporary directory for clone: {e}") from e

        try:
            logger.info("Cloning repository from %s to %s", repo_url, temp_dir)
            # Execute git clone
            # Use --depth 1 to minimize download size and speed up ingestion
            subprocess.run(
                ["git", "clone", "--depth", "1", clone_url, temp_dir],
                check=True,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True
            )
            logger.info("Successfully cloned repository to %s", temp_dir)
            return os.path.abspath(temp_dir)
        except subprocess.CalledProcessError as e:
            err_msg = e.stderr.strip() if e.stderr else (e.stdout.strip() if e.stdout else str(e))
            logger.error("Git clone failed: %s", err_msg)
            if os.path.exists(temp_dir):
                try:
                    safe_rmtree(temp_dir)
                    logger.info("Cleaned up temporary directory %s after clone failure", temp_dir)
                except Exception as cleanup_err:
                    logger.exception("Failed to clean up directory %s after clone failure", temp_dir)
            raise RuntimeError(f"Failed to clone repository: {err_msg}") from e
        except Exception as e:
            logger.exception("An unexpected error occurred during repository clone")
            if os.path.exists(temp_dir):
                try:
                    safe_rmtree(temp_dir)
                    logger.info("Cleaned up temporary directory %s after clone failure", temp_dir)
                except Exception as cleanup_err:
                    logger.exception("Failed to clean up directory %s after clone failure", temp_dir)
            raise RuntimeError(f"An unexpected error occurred during repository clone: {e}") from e

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
        temp_dir = self.clone_repository(repo_url)
        results: List[Dict[str, Any]] = []

        try:
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
                            logger.warning("Failed to read file %s: %s", file_path, e)
                            continue
        finally:
            if os.path.exists(temp_dir):
                try:
                    safe_rmtree(temp_dir)
                    logger.info("Cleaned up temporary directory %s after file scanning", temp_dir)
                except Exception as cleanup_err:
                    logger.exception("Failed to clean up temporary directory %s after scanning", temp_dir)

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

