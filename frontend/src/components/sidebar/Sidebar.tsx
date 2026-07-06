import { useState, useEffect } from 'react'
import { NavLink } from 'react-router-dom'
import { LayoutGrid, FileText, GitCommit, GitPullRequest, Users, AlertCircle, MessageSquare, Settings, ChevronLeft, ChevronRight } from 'lucide-react'

const sections = [
  { name: 'Overview', href: '/repository', icon: LayoutGrid },
  { name: 'Files', href: '/files', icon: FileText },
  { name: 'Commits', href: '/repository#commits', icon: GitCommit },
  { name: 'Pull Requests', href: '/repository#pulls', icon: GitPullRequest },
  { name: 'Contributors', href: '/contributors', icon: Users },
  { name: 'Issues', href: '/issues', icon: AlertCircle },
  { name: 'Chat', href: '/chat', icon: MessageSquare },
  { name: 'Settings', href: '/settings', icon: Settings },
]

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  useEffect(() => {
    try {
      const raw = localStorage.getItem('sidebar_collapsed')
      if (raw != null) setCollapsed(raw === '1')
    } catch {}
  }, [])

  useEffect(() => {
    try { localStorage.setItem('sidebar_collapsed', collapsed ? '1' : '0') } catch {}
  }, [collapsed])

  return (
    <>
      {/* Desktop sidebar */}
      <aside className={`hidden w-64 flex-shrink-0 md:flex md:flex-col ${collapsed ? 'w-20' : 'w-64'}`}>
        <div className="flex h-full flex-col border-r border-slate-100 bg-white/60 dark:border-slate-800 dark:bg-slate-950/60">
          <div className="flex items-center justify-between px-4 py-3">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded bg-indigo-600 text-white flex items-center justify-center">RI</div>
              {!collapsed && <div className="text-sm font-semibold">Repository</div>}
            </div>
            <button className="rounded p-1 text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800" onClick={() => setCollapsed((c) => !c)} aria-label="Toggle sidebar">
              {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
            </button>
          </div>

          <nav className="flex-1 overflow-y-auto px-2 py-4">
            <ul className="space-y-1">
              {sections.map((s) => {
                const Icon = s.icon
                return (
                  <li key={s.name}>
                    <NavLink to={s.href} className={({ isActive }) => `group flex items-center gap-3 rounded-md px-3 py-2 text-sm transition ${isActive ? 'bg-slate-100 text-slate-900 dark:bg-slate-800 dark:text-white' : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'}`}>
                      <Icon className="h-4 w-4" />
                      {!collapsed && <span className="truncate">{s.name}</span>}
                    </NavLink>
                  </li>
                )
              })}
            </ul>
          </nav>
        </div>
      </aside>

      {/* Mobile sidebar overlay */}
      <div className="md:hidden">
        <div className="px-2 py-2">
          <button onClick={() => setMobileOpen(true)} className="rounded-md border border-slate-200 px-3 py-2 text-sm dark:border-slate-800">Menu</button>
        </div>
        {mobileOpen && (
          <div className="fixed inset-0 z-50 flex">
            <div className="w-64 border-r border-slate-100 bg-white p-4 dark:border-slate-800 dark:bg-slate-950">
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold">Repository</div>
                <button onClick={() => setMobileOpen(false)} className="text-slate-500">Close</button>
              </div>
              <nav className="mt-4">
                <ul className="space-y-1">
                  {sections.map((s) => {
                    const Icon = s.icon
                    return (
                      <li key={s.name}>
                        <NavLink to={s.href} onClick={() => setMobileOpen(false)} className={({ isActive }) => `flex items-center gap-3 rounded-md px-3 py-2 text-sm ${isActive ? 'bg-slate-100 text-slate-900 dark:bg-slate-800 dark:text-white' : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'}`}>
                          <Icon className="h-4 w-4" />
                          <span>{s.name}</span>
                        </NavLink>
                      </li>
                    )
                  })}
                </ul>
              </nav>
            </div>
            <div className="flex-1" onClick={() => setMobileOpen(false)} />
          </div>
        )}
      </div>
    </>
  )
}

export default Sidebar
