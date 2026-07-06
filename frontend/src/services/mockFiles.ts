export type FileNode = {
  id: string
  name: string
  type: 'file' | 'folder'
  path: string
  children?: FileNode[]
  language?: string
  content?: string
}

export const mockFileTree: FileNode[] = [
  {
    id: 'src',
    name: 'src',
    type: 'folder',
    path: 'src',
    children: [
      {
        id: 'main.tsx',
        name: 'main.tsx',
        type: 'file',
        path: 'src/main.tsx',
        language: 'tsx',
        content: "import React from 'react'\nimport ReactDOM from 'react-dom/client'\n\nReactDOM.createRoot(document.getElementById('root')!).render(<App />)\n"
      },
      {
        id: 'App.tsx',
        name: 'App.tsx',
        type: 'file',
        path: 'src/App.tsx',
        language: 'tsx',
        content: "export function App() {\n  return <div>Hello from repo explorer</div>\n}\n"
      },
      {
        id: 'components',
        name: 'components',
        type: 'folder',
        path: 'src/components',
        children: [
          {
            id: 'Button.tsx',
            name: 'Button.tsx',
            type: 'file',
            path: 'src/components/Button.tsx',
            language: 'tsx',
            content: "export function Button({ children }: { children: React.ReactNode }) {\n  return <button>{children}</button>\n}\n"
          },
          {
            id: 'index.ts',
            name: 'index.ts',
            type: 'file',
            path: 'src/components/index.ts',
            language: 'ts',
            content: "export * from './Button'\n"
          }
        ]
      },
      {
        id: 'controllers',
        name: 'controllers',
        type: 'folder',
        path: 'src/controllers',
        children: [
          {
            id: 'AuthController.java',
            name: 'AuthController.java',
            type: 'file',
            path: 'src/controllers/AuthController.java',
            language: 'java',
            content: "package com.example.app.controllers;\n\nimport com.example.app.services.AuthService;\nimport org.springframework.web.bind.annotation.PostMapping;\nimport org.springframework.web.bind.annotation.RequestBody;\nimport org.springframework.web.bind.annotation.RestController;\n\n@RestController\npublic class AuthController {\n    private final AuthService authService;\n\n    public AuthController(AuthService authService) {\n        this.authService = authService;\n    }\n\n    @PostMapping(\"/login\")\n    public LoginResponse login(@RequestBody LoginRequest request) {\n        return authService.authenticate(request);\n    }\n}\n"
          }
        ]
      },
      {
        id: 'utils.ts',
        name: 'utils.ts',
        type: 'file',
        path: 'src/utils.ts',
        language: 'ts',
        content: "export function cn(...classes: string[]) {\n  return classes.filter(Boolean).join(' ')\n}\n"
      }
    ]
  },
  {
    id: 'README.md',
    name: 'README.md',
    type: 'file',
    path: 'README.md',
    language: 'markdown',
    content: "# Repo Intelligence Assistant\n\nThis is a mock repository file explorer. Use the tree to open files.\n"
  },
  {
    id: 'package.json',
    name: 'package.json',
    type: 'file',
    path: 'package.json',
    language: 'json',
    content: '{\n  "name": "repo-intelligence-assistance",\n  "version": "0.0.0"\n}\n'
  }
]
