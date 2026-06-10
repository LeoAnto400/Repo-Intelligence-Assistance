import unittest
from src.services.chunker import CodeFile, Chunk, CodeChunker

class TestCodeChunker(unittest.TestCase):
    def setUp(self):
        self.chunker = CodeChunker()

    def test_chunk_python_success(self):
        content = (
            "# Module level comment\n"
            "import os\n"
            "\n"
            "@decorator\n"
            "class MyClass:\n"
            "    def __init__(self):pass\n"
            "    def method(self):pass\n"
            "\n"
            "def my_func(a: int) -> int:\n"
            "    return a + 1\n"
            "\n"
            "async def my_async_func():\n"
            "    pass\n"
        )
        code_file = CodeFile(
            file_path="src/main.py",
            content=content,
            language="Python",
            metadata={"repo_name": "test-repo", "author": "dev"}
        )
        
        chunks = self.chunker.chunk_file(code_file)
        
        # We expect 3 chunks: MyClass, my_func, my_async_func
        self.assertEqual(len(chunks), 3)
        
        # Verify Class Chunk
        class_chunk = chunks[0]
        self.assertEqual(class_chunk.chunk_type, "class")
        self.assertEqual(class_chunk.file_path, "src/main.py")
        self.assertIn("class MyClass:", class_chunk.content)
        self.assertIn("@decorator", class_chunk.content)
        self.assertEqual(class_chunk.metadata["name"], "MyClass")
        self.assertEqual(class_chunk.metadata["repo_name"], "test-repo")
        self.assertEqual(class_chunk.metadata["author"], "dev")
        self.assertEqual(class_chunk.metadata["start_line"], 4)
        
        # Verify Function Chunk
        func_chunk = chunks[1]
        self.assertEqual(func_chunk.chunk_type, "function")
        self.assertEqual(func_chunk.file_path, "src/main.py")
        self.assertIn("def my_func(a: int) -> int:", func_chunk.content)
        self.assertEqual(func_chunk.metadata["name"], "my_func")
        self.assertEqual(func_chunk.metadata["repo_name"], "test-repo")
        self.assertEqual(func_chunk.metadata["start_line"], 9)
        self.assertEqual(func_chunk.metadata["end_line"], 10)
        
        # Verify Async Function Chunk
        async_func_chunk = chunks[2]
        self.assertEqual(async_func_chunk.chunk_type, "function")
        self.assertEqual(async_func_chunk.file_path, "src/main.py")
        self.assertIn("async def my_async_func():", async_func_chunk.content)
        self.assertEqual(async_func_chunk.metadata["name"], "my_async_func")
        self.assertEqual(async_func_chunk.metadata["repo_name"], "test-repo")
        self.assertEqual(async_func_chunk.metadata["start_line"], 12)
        self.assertEqual(async_func_chunk.metadata["end_line"], 13)

    def test_chunk_python_no_classes_functions(self):
        content = (
            "# Just simple module level code\n"
            "x = 5\n"
            "y = 10\n"
            "print(x + y)\n"
        )
        code_file = CodeFile(
            file_path="src/script.py",
            content=content,
            language="python",
            metadata={"owner": "user"}
        )
        
        chunks = self.chunker.chunk_file(code_file)
        
        # Should fall back to a single file-level chunk
        self.assertEqual(len(chunks), 1)
        self.assertEqual(chunks[0].chunk_type, "file")
        self.assertEqual(chunks[0].content, content)
        self.assertEqual(chunks[0].metadata["owner"], "user")
        self.assertEqual(chunks[0].metadata["start_line"], 1)
        self.assertEqual(chunks[0].metadata["end_line"], 4)

    def test_chunk_python_syntax_error(self):
        content = (
            "class UnfinishedClass\n"  # Syntax error: missing colon
            "    def method(self):\n"
        )
        code_file = CodeFile(
            file_path="src/invalid.py",
            content=content,
            language="Python",
            metadata={"status": "broken"}
        )
        
        chunks = self.chunker.chunk_file(code_file)
        
        # Should gracefully fall back to file-level chunk
        self.assertEqual(len(chunks), 1)
        self.assertEqual(chunks[0].chunk_type, "file")
        self.assertEqual(chunks[0].content, content)
        self.assertEqual(chunks[0].metadata["status"], "broken")

    def test_chunk_other_language(self):
        content = (
            "function add(a, b) {\n"
            "    return a + b;\n"
            "}\n"
            "class Greeter {\n"
            "    greet() { console.log('hello'); }\n"
            "}\n"
        )
        code_file = CodeFile(
            file_path="src/index.js",
            content=content,
            language="JavaScript",
            metadata={"type": "frontend"}
        )
        
        chunks = self.chunker.chunk_file(code_file)
        
        # Non-python languages fall back to file-level chunking
        self.assertEqual(len(chunks), 1)
        self.assertEqual(chunks[0].chunk_type, "file")
        self.assertEqual(chunks[0].content, content)
        self.assertEqual(chunks[0].metadata["type"], "frontend")

    def test_chunk_empty_file(self):
        code_file = CodeFile(
            file_path="src/empty.py",
            content="",
            language="Python"
        )
        
        chunks = self.chunker.chunk_file(code_file)
        
        self.assertEqual(len(chunks), 1)
        self.assertEqual(chunks[0].chunk_type, "file")
        self.assertEqual(chunks[0].content, "")

    def test_chunk_id_stability(self):
        content = "def test():\n    pass"
        file1 = CodeFile("src/t.py", content, "Python")
        file2 = CodeFile("src/t.py", content, "Python")
        file3 = CodeFile("src/other.py", content, "Python")
        
        chunks1 = self.chunker.chunk_file(file1)
        chunks2 = self.chunker.chunk_file(file2)
        chunks3 = self.chunker.chunk_file(file3)
        
        # Same file, same content -> same ID
        self.assertEqual(chunks1[0].chunk_id, chunks2[0].chunk_id)
        # Different file path -> different ID
        self.assertNotEqual(chunks1[0].chunk_id, chunks3[0].chunk_id)

if __name__ == "__main__":
    unittest.main()
