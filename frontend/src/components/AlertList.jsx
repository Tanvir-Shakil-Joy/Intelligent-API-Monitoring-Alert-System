import React from 'react';
import AlertCard from './AlertCard';

export default function AlertList({ alerts, isLoading, error, onRetry }) {
  if (isLoading) {
    return (
      <div className="state-container loading-state">
        <div className="spinner"></div>
        <p className="state-title">Retrieving active anomalies...</p>
        <p className="state-desc">Polling backend database for operational telemetry.</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="state-container error-state">
        <div className="state-icon">⚠️</div>
        <h3 className="state-title">Unable to Load Alerts</h3>
        <p className="state-desc">{error}</p>
        <button className="btn btn-primary" onClick={onRetry}>
          Try Again
        </button>
      </div>
    );
  }

  if (!alerts || alerts.length === 0) {
    return (
      <div className="state-container empty-state">
        <div className="state-icon">✅</div>
        <h3 className="state-title">All Systems Healthy</h3>
        <p className="state-desc">
          No active anomalies detected matching current criteria. External APIs are operating within acceptable thresholds.
        </p>
      </div>
    );
  }

  return (
    <div className="alert-list-container">
      <div className="list-meta">
        <span>Showing <strong>{alerts.length}</strong> active alert{alerts.length === 1 ? '' : 's'}</span>
      </div>
      <div className="alert-grid">
        {alerts.map((alert) => (
          <AlertCard key={alert.id || alert._id} alert={alert} />
        ))}
      </div>
    </div>
  );
}
