import React from 'react';

function formatRelativeTime(dateString) {
  if (!dateString) return 'Just now';
  const now = new Date();
  const past = new Date(dateString);
  const diffSec = Math.floor((now - past) / 1000);

  if (diffSec < 10) return 'Just now';
  if (diffSec < 60) return `${diffSec}s ago`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  return past.toLocaleDateString();
}

export default function AlertCard({ alert }) {
  const {
    apiName,
    severity = 'medium',
    anomalyTypes = [],
    metrics = {},
    message,
    messageSource = 'fallback',
    createdAt
  } = alert;

  const severityClass = `badge-severity-${severity.toLowerCase()}`;
  const sourceClass = messageSource === 'ai' ? 'badge-source-ai' : 'badge-source-fallback';

  const statusCode = metrics.statusCode;
  const isStatusError = statusCode >= 400;

  return (
    <article className={`alert-card border-${severity.toLowerCase()}`}>
      <div className="alert-card-header">
        <div className="alert-card-title-wrap">
          <span className={`badge ${severityClass}`}>
            {severity.toUpperCase()}
          </span>
          <h3 className="alert-api-name">{apiName}</h3>
          <span className={`badge ${sourceClass}`} title={messageSource === 'ai' ? 'Generated using LLM' : 'Generated via deterministic fallback'}>
            {messageSource === 'ai' ? '✨ AI Alert' : '⚙️ Fallback'}
          </span>
        </div>
        <time className="alert-time" dateTime={createdAt} title={new Date(createdAt).toLocaleString()}>
          {formatRelativeTime(createdAt)}
        </time>
      </div>

      <div className="alert-message-box">
        <p className="alert-message">{message}</p>
      </div>

      <div className="alert-card-footer">
        <div className="metrics-pill-wrap">
          <span className={`metric-pill ${isStatusError ? 'metric-error' : 'metric-ok'}`}>
            Status: <strong>{statusCode || 'N/A'}</strong>
          </span>
          <span className={`metric-pill ${metrics.responseTimeMs > 3000 ? 'metric-warn' : 'metric-neutral'}`}>
            Latency: <strong>{metrics.responseTimeMs !== undefined ? `${metrics.responseTimeMs} ms` : 'N/A'}</strong>
          </span>
          <span className={`metric-pill ${metrics.recordsReturned === 0 || metrics.recordsReturned === null ? 'metric-warn' : 'metric-neutral'}`}>
            Records: <strong>{metrics.recordsReturned !== null && metrics.recordsReturned !== undefined ? metrics.recordsReturned : 'None / Null'}</strong>
          </span>
        </div>

        {anomalyTypes && anomalyTypes.length > 0 && (
          <div className="anomaly-tags">
            {anomalyTypes.map((type) => (
              <span key={type} className="anomaly-tag">
                {type}
              </span>
            ))}
          </div>
        )}
      </div>
    </article>
  );
}
