import { useState } from 'react';
import './TokenCard.css';

function TokenCard({ token }) {
  const [copied, setCopied] = useState(false);

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const truncateAddress = (addr) => {
    if (!addr || addr.length < 10) return addr || 'N/A';
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    return date.toLocaleDateString();
  };

  return (
    <div className="token-card">
      <div className="card-header">
        <div className="token-info">
          <h3 className="token-name">{token.name || 'Unknown Token'}</h3>
          {token.symbol && <span className="token-symbol">{token.symbol}</span>}
        </div>
        <span className="token-time">{formatTime(token.timestamp)}</span>
      </div>

      {token.tags && (
        <div className="card-tags">
          {token.tags.split(',').map((tag, i) => (
            <span key={i} className="tag">{tag.trim()}</span>
          ))}
        </div>
      )}

      <div className="card-body">
        {token.creator && (
          <div className="info-row">
            <span className="info-label">Creator:</span>
            <span className="info-value creator">{token.creator}</span>
          </div>
        )}

        {token.followers && (
          <div className="info-row">
            <span className="info-label">Followers:</span>
            <span className="info-value">{token.followers}</span>
          </div>
        )}

        {token.tokensCreated && (
          <div className="info-row">
            <span className="info-label">Tokens created:</span>
            <span className="info-value">{token.tokensCreated}</span>
          </div>
        )}

        <div className="info-row">
          <span className="info-label">Contract:</span>
          <span className="info-value contract-address" title={token.contract}>
            {truncateAddress(token.contract)}
          </span>
        </div>

        {token.tax && (
          <div className="info-row">
            <span className="info-label">Tax:</span>
            <span className="info-value tax">{token.tax}</span>
          </div>
        )}

        {token.liquidity && (
          <div className="info-row">
            <span className="info-label">Liquidity:</span>
            <span className="info-value">{token.liquidity}</span>
          </div>
        )}
      </div>

      <div className="card-actions">
        <button
          className={`action-btn copy-btn ${copied ? 'copied' : ''}`}
          onClick={() => copyToClipboard(token.contract)}
          disabled={!token.contract}
        >
          {copied ? '✓ Copied' : '📋 Copy'}
        </button>
        <a
          href={`https://basescan.org/address/${token.contract}`}
          target="_blank"
          rel="noopener noreferrer"
          className="action-btn"
        >
          🔗 Scan
        </a>
        <a
          href={`https://app.uniswap.org/#/swap?outputCurrency=${token.contract}&chain=base`}
          target="_blank"
          rel="noopener noreferrer"
          className="action-btn"
        >
          💧 Trade
        </a>
      </div>
    </div>
  );
}

export default TokenCard;
