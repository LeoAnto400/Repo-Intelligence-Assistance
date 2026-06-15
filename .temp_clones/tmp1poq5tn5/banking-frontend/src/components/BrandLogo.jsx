function BrandLogo({ label = 'BlueCrest Bank', sublabel = 'Private Banking', compact = false, admin = false }) {
  return (
    <div className={`brand-lockup${compact ? ' brand-lockup--compact' : ''}${admin ? ' brand-lockup--admin' : ''}`}>
      <div className="brand-lockup__mark" aria-hidden="true">
        <span className="brand-lockup__ring">
          <svg viewBox="0 0 64 64" className="brand-lockup__svg" focusable="false">
            <path d="M32 10 48 18v6H16v-6l16-8Z" fill="currentColor" opacity="0.95" />
            <path d="M20 28h6v16h-6zm9 0h6v16h-6zm9 0h6v16h-6z" fill="currentColor" opacity="0.86" />
            <path d="M14 46h36v6H14z" fill="currentColor" />
          </svg>
        </span>
      </div>
      <div className="brand-lockup__copy">
        <strong>{label}</strong>
        <span>{sublabel}</span>
      </div>
    </div>
  )
}

export default BrandLogo
