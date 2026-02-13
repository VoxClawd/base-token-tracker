import './Header.css';

function Header({ connected, tokenCount }) {
  return (
    <header className="header">
      <div className="header-content">
        <div className="header-left">
          <h1 className="header-title">
            <span className="logo">⚡</span>
            Base Token Tracker
          </h1>
          <p className="header-subtitle">Live deployment feed</p>
        </div>
        <div className="header-right">
          <div className="status-badge">
            <span className={`status-dot ${connected ? 'connected' : 'disconnected'}`}></span>
            <span className="status-text">
              {connected ? 'Connected' : 'Disconnected'}
            </span>
          </div>
          <div className="token-count">
            <span className="count-number">{tokenCount}</span>
            <span className="count-label">tokens</span>
          </div>
        </div>
      </div>
    </header>
  );
}

export default Header;
