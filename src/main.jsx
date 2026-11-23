import React from 'react';
import { createRoot } from 'react-dom/client';
import { Brand } from './Brand.jsx';
import { Dashboard } from './Dashboard.jsx';
import './styles.css';

const signInMessages = {
  required: 'Sign in to open your prompt library.',
  unavailable: 'GitHub sign-in is unavailable on this instance. Check the server setup.',
  expired: 'The GitHub sign-in request expired. Please try again.',
  cancelled: 'GitHub sign-in was cancelled.',
  failed: 'GitHub sign-in failed. Please try again.',
};

function Landing() {
  const signIn = new URLSearchParams(window.location.search).get('sign_in');
  const message = Object.hasOwn(signInMessages, signIn) && signInMessages[signIn];

  return (
    <>
      <header className="topbar">
        <nav className="container nav" aria-label="Main">
          <Brand />
          <div className="nav-actions">
            <a className="nav-link" href="#how-it-works">How it works</a>
            <a className="button button-outline" href="/login">Sign in</a>
          </div>
        </nav>
      </header>
      <main id="main" className="container landing">
        <section className="hero" aria-labelledby="hero-title">
          <div className="hero-copy">
            <p className="eyebrow"><span className="privacy-dot" />Private prompt library</p>
            <h1 id="hero-title">Keep the prompts <em>worth keeping.</em></h1>
            <p className="hero-summary">Save the prompts you use for coding, writing and research. Record what worked so you can pick up where you left off.</p>
            <a className="button button-primary hero-button" href="/login">Continue with GitHub</a>
            {message && <p className="notice" role="status">{message}</p>}
          </div>
          <div className="hero-art" aria-hidden="true"><img src="/capsule-art.jpg" alt="" width="1122" height="1402" /></div>
        </section>
        <section id="how-it-works" className="workflow" aria-labelledby="workflow-title">
          <h2 id="workflow-title">How it works</h2>
          <div className="workflow-grid">
            <div><span className="workflow-icon" aria-hidden="true">+</span><h3>Save a prompt</h3><p>Keep the full prompt with its project, version and category.</p></div>
            <div><span className="workflow-icon" aria-hidden="true">✓</span><h3>Review the result</h3><p>Summarize the response, rate its usefulness and attach a screenshot link if you have one.</p></div>
            <div><span className="workflow-icon" aria-hidden="true">↻</span><h3>Refine your work</h3><p>Update a capsule as you iterate. Your library is private to your GitHub account.</p></div>
          </div>
        </section>
      </main>
      <footer className="site-footer"><div className="container"><Brand /></div></footer>
    </>
  );
}

createRoot(document.getElementById('root')).render(
  window.location.pathname.replace(/\/$/, '') === '/dashboard' ? <Dashboard /> : <Landing />,
);
