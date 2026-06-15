import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import BrandLogo from '../components/BrandLogo.jsx'
import ThemeToggle from '../components/ThemeToggle.jsx'
import { apiBaseUrl } from '../config/api'
import { useTheme } from '../context/ThemeContext.jsx'

function AdminLoginPage() {
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
      const response = await fetch(`${apiBaseUrl}/admin/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      })

      const data = await response.json().catch(() => ({}))

      if (!response.ok) {
        throw new Error(data.message || 'Admin login failed. Please try again.')
      }

      if (!data.token) {
        throw new Error('Admin login succeeded but no token was returned.')
      }

      localStorage.setItem('token', data.token)
      localStorage.setItem('bank_user', JSON.stringify(data.user || {}))
      navigate('/admin-dashboard')
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
          <BrandLogo label="BlueCrest Bank" sublabel="Operations Control Desk" admin />
          <p className="hero-card__eyebrow">Admin Login</p>
          <h1>Operational control for branch and finance teams.</h1>
          <p className="hero-card__text">
            Access branch-level customers, accounts, transactions, and lending
            activity through the dedicated admin workspace.
          </p>

          <div className="hero-stat-grid" aria-label="Admin portal highlights">
            <div className="hero-stat">
              <strong>Branch</strong>
              <span>Scoped operational visibility</span>
            </div>
            <div className="hero-stat">
              <strong>Audit</strong>
              <span>Structured access for staff users</span>
            </div>
            <div className="hero-stat">
              <strong>Fast</strong>
              <span>Direct route into branch dashboards</span>
            </div>
          </div>

          <div className="hero-card__actions">
            <Link className="button-link button-link--secondary" to="/">
              Back to Customer Login
            </Link>
          </div>

          <div className="hero-list">
            <div className="hero-list__item">
              <div className="hero-list__icon">01</div>
              <div>
                <strong>Restricted admin access</strong>
                <p>Separate authentication for accountant records and branch oversight.</p>
              </div>
            </div>
            <div className="hero-list__item">
              <div className="hero-list__icon">02</div>
              <div>
                <strong>Clear branch context</strong>
                <p>Review customers, account exposure, lending, and transaction activity faster.</p>
              </div>
            </div>
          </div>
        </article>

        <aside className="form-card">
          <div className="auth-card__topbar">
            <div>
          <h2>Admin Login</h2>
          <p>Use your accountant email and password to continue into branch operations.</p>
            </div>
            <ThemeToggle theme={theme} onToggle={toggleTheme} />
          </div>

          <div className="auth-meta">
            <span className="auth-meta__pill">Admin access</span>
            <span className="auth-meta__pill">Branch scoped</span>
          </div>

          <form className="auth-form" onSubmit={handleSubmit}>
            <label className="field-group" htmlFor="admin-email">
              <span>Email</span>
              <input
                id="admin-email"
                name="email"
                type="email"
                value={formData.email}
                onChange={handleChange}
                placeholder="admin@bank.com"
                autoComplete="email"
                required
              />
            </label>

            <label className="field-group" htmlFor="admin-password">
              <span>Password</span>
              <input
                id="admin-password"
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
              {isSubmitting ? 'Logging in...' : 'Admin Login'}
            </button>

            <p className="auth-helper">
              Customer user? <Link to="/">Back to customer login</Link>
            </p>
          </form>
        </aside>
      </section>
    </main>
  )
}

export default AdminLoginPage
