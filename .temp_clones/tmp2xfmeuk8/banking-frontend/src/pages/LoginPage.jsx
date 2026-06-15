import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import BrandLogo from '../components/BrandLogo.jsx'
import ThemeToggle from '../components/ThemeToggle.jsx'
import { apiBaseUrl } from '../config/api'
import { useTheme } from '../context/ThemeContext.jsx'

function LoginPage() {
  const navigate = useNavigate()
  const { theme, toggleTheme } = useTheme()
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  })
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleChange = (event) => {
    const { name, value } = event.target
    setFormData((current) => ({
      ...current,
      [name]: value,
    }))
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError('')
    setIsSubmitting(true)

    try {
      const response = await fetch(`${apiBaseUrl}/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      })

      const data = await response.json().catch(() => ({}))

      if (!response.ok) {
        throw new Error(data.message || 'Login failed. Please try again.')
      }

      if (!data.token) {
        throw new Error('Login succeeded but no token was returned.')
      }

      localStorage.setItem('token', data.token)
      localStorage.setItem('bank_user', JSON.stringify(data.user || {}))
      navigate('/dashboard')
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : 'Something went wrong while logging in.'
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <main className="app-shell">
      <section className="page-columns">
        <article className="hero-card">
          <div className="hero-card__topbar">
            <BrandLogo label="BlueCrest Bank" sublabel="Digital Banking Suite" />
            <ThemeToggle theme={theme} onToggle={toggleTheme} />
          </div>
          <p className="hero-card__eyebrow">Login</p>
          <h1>Banking access with a clearer, calmer workspace.</h1>
          <p className="hero-card__text">
            Review balances, recent activity, cards, loans, and transfers from a
            single customer portal backed by your banking database.
          </p>

          <div className="hero-stat-grid" aria-label="Customer portal highlights">
            <div className="hero-stat">
              <strong>24/7</strong>
              <span>Self-service account access</span>
            </div>
            <div className="hero-stat">
              <strong>Live</strong>
              <span>Transaction and transfer visibility</span>
            </div>
            <div className="hero-stat">
              <strong>Secure</strong>
              <span>Email-based customer authentication</span>
            </div>
          </div>

          <div className="hero-card__actions">
            <Link className="button-link button-link--secondary" to="/signup">
              Create an account
            </Link>
          </div>

          <div className="hero-list">
            <div className="hero-list__item">
              <div className="hero-list__icon">01</div>
              <div>
                <strong>Customer-ready dashboard</strong>
                <p>See accounts, cards, transfers, loans, and profile details in one place.</p>
              </div>
            </div>
            <div className="hero-list__item">
              <div className="hero-list__icon">02</div>
              <div>
                <strong>Professional workflow</strong>
                <p>Clear navigation, focused forms, and fast handoff into the dashboard.</p>
              </div>
            </div>
          </div>
        </article>

        <aside className="form-card">
          <div className="auth-card__topbar">
            <div>
          <h2>Customer Login</h2>
          <p>Enter your registered email and password to continue into the customer portal.</p>
            </div>
          </div>

          <div className="auth-meta">
            <span className="auth-meta__pill">Customer access</span>
            <span className="auth-meta__pill">Secure session</span>
          </div>

          <form className="auth-form" onSubmit={handleSubmit}>
            <label className="field-group" htmlFor="email">
              <span>Email</span>
              <input
                id="email"
                name="email"
                type="email"
                value={formData.email}
                onChange={handleChange}
                placeholder="manager@bank.com"
                autoComplete="email"
                required
              />
            </label>

            <label className="field-group" htmlFor="password">
              <span>Password</span>
              <input
                id="password"
                name="password"
                type="password"
                value={formData.password}
                onChange={handleChange}
                placeholder="Enter your password"
                autoComplete="current-password"
                required
              />
            </label>

            {error ? <p className="form-error">{error}</p> : null}

            <button className="button-link button-link--primary auth-submit" type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Logging in...' : 'Login'}
            </button>

            <p className="auth-helper">
              Don&apos;t have an account? <Link to="/signup">Sign up</Link>
            </p>
            <p className="auth-helper auth-helper--muted">
              Admin user? <Link to="/admin-login">Admin login</Link>
            </p>
          </form>
        </aside>
      </section>
    </main>
  )
}

export default LoginPage
