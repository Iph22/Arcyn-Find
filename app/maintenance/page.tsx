export default function MaintenancePage() {
  return (
    <html lang="en">
      <head>
        <title>Maintenance Mode - Arcyn Find</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="robots" content="noindex, nofollow" />
      </head>
      <body style={{
        margin: 0,
        padding: 0,
        fontFamily: 'system-ui, -apple-system, sans-serif',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'white'
      }}>
        <div style={{
          textAlign: 'center',
          padding: '2rem',
          maxWidth: '600px'
        }}>
          <h1 style={{ fontSize: '3rem', marginBottom: '1rem' }}>🔧</h1>
          <h2 style={{ fontSize: '2rem', marginBottom: '1rem', fontWeight: 'bold' }}>We'll be back soon!</h2>
          <p style={{ fontSize: '1.2rem', opacity: 0.9, lineHeight: '1.6' }}>
            Arcyn Find is currently undergoing maintenance. We're working hard to improve your experience.
          </p>
          <p style={{ marginTop: '2rem', opacity: 0.7, fontSize: '1rem' }}>
            Please check back shortly.
          </p>
        </div>
      </body>
    </html>
  )
}

