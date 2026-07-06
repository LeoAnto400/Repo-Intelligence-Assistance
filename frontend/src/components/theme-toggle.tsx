import { Moon, Sun } from 'lucide-react'
import { useTheme } from '../hooks/use-theme'
import { Button } from './ui/button'

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme()

  return (
    <Button variant="outline" size="icon" onClick={toggleTheme} aria-label="Toggle color theme">
      {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </Button>
  )
}
