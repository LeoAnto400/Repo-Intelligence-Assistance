import type { ReactNode } from 'react'
import { NavLink } from 'react-router-dom'
import { Bot, FolderGit2, Home, Menu, Sparkles } from 'lucide-react'
import { ThemeToggle } from '../components/theme-toggle'
import { Button } from '../components/ui/button'
import Sidebar from '../components/sidebar/Sidebar'

const navigation = [
  { name: 'Home', href: '/', icon: Home },
  { name: 'Repository', href: '/repository', icon: FolderGit2 },
  { name: 'Chat', href: '/chat', icon: Bot },
]

type AppShellProps = {
  children: ReactNode
}

export function AppShell({ children }: AppShellProps) {
  return (
    <div className="min-h-screen bg-transparent text-slate-900 transition-colors dark:text-slate-100">
      <header className="border-b border-slate-200/80 bg-white/80 backdrop-blur dark:border-slate-800 dark:bg-slate-950/70">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-lg shadow-indigo-600/20">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <p className="text-lg font-semibold tracking-tight">Repo Intelligence</p>
              <p className="text-sm text-slate-500 dark:text-slate-400">Repository Intelligence Assistant</p>
            </div>
          </div>

          <nav className="hidden items-center gap-2 md:flex">
            {navigation.map((item) => {
              const Icon = item.icon
              return (
                <NavLink
                  key={item.name}
                  to={item.href}
                  className={({ isActive }) =>
                    `inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition ${
                      isActive
                        ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'
                        : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white'
                    }`
                  }
                >
                  <Icon className="h-4 w-4" />
                  {item.name}
                </NavLink>
              )
            })}
          </nav>

          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Button variant="outline" size="icon" className="md:hidden">
              <Menu className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto flex min-h-[calc(100vh-73px)] w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex w-full gap-6">
          <Sidebar />
          <div className="flex min-h-[calc(100vh-73px)] flex-1 flex-col py-8">
            {children}
          </div>
        </div>
      </main>
    </div>
  )
}
