function ThemeToggle({ theme, onToggle }) {
  const isDark = theme === 'dark'

  return (
    <button
      type="button"
      className="app-theme-toggle"
      onClick={onToggle}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
    >
      <span className={`app-theme-toggle__orb ${isDark ? 'is-dark' : 'is-light'}`} aria-hidden="true">
        <span className="app-theme-toggle__core" />
      </span>
    </button>
  )
}

export default ThemeToggle
