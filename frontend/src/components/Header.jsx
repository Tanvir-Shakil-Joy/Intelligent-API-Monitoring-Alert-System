import React from 'react';

export default function Header({
  isOnline,
  countdown,
  onRefresh,
  isRefreshing,
  showMonitorPanel,
  onToggleMonitorPanel
}) {
  return (
    <header className="app-header">
      <div className="header-brand">
        <div className="brand-icon">🛡️</div>
        <div>
          <h1 className="brand-title">Intelligent API Monitoring & Alert System</h1>
          <p className="brand-subtitle">Automated Anomaly Detection & AI Operational Alerts</p>
        </div>
      </div>

      <div className="header-actions">
        <div className={`status-pill ${isOnline ? 'online' : 'offline'}`}>
          <span className="status-dot"></span>
          <span>{isOnline ? 'System Online' : 'Connecting...'}</span>
        </div>

        <div className="countdown-pill" title="Auto-refreshing active alerts">
          ⏱️ Refresh in <strong>{countdown}s</strong>
        </div>

        <button
          className="btn btn-secondary"
          onClick={onRefresh}
          disabled={isRefreshing}
          title="Manually refresh alerts now"
        >
          {isRefreshing ? 'Refreshing...' : '🔄 Refresh'}
        </button>

        <button
          className={`btn ${showMonitorPanel ? 'btn-primary' : 'btn-outline'}`}
          onClick={onToggleMonitorPanel}
          title="Toggle interactive batch tester"
        >
          {showMonitorPanel ? '✕ Close Monitor' : '⚡ Run Monitor Batch'}
        </button>
      </div>
    </header>
  );
}
