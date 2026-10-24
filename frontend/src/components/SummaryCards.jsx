import React from 'react';

export default function SummaryCards({ counts, activeSeverity, onSelectSeverity }) {
  const cards = [
    {
      id: 'all',
      label: 'Total Active Alerts',
      count: counts.total,
      colorClass: 'card-total',
      icon: '🔔'
    },
    {
      id: 'critical',
      label: 'Critical Anomalies',
      count: counts.critical,
      colorClass: 'card-critical',
      icon: '🚨'
    },
    {
      id: 'high',
      label: 'High Severity',
      count: counts.high,
      colorClass: 'card-high',
      icon: '⚠️'
    },
    {
      id: 'medium',
      label: 'Medium Severity',
      count: counts.medium,
      colorClass: 'card-medium',
      icon: 'ℹ️'
    }
  ];

  return (
    <div className="summary-grid">
      {cards.map((card) => {
        const isSelected = activeSeverity === card.id;
        return (
          <div
            key={card.id}
            className={`summary-card ${card.colorClass} ${isSelected ? 'selected' : ''}`}
            onClick={() => onSelectSeverity(card.id)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onSelectSeverity(card.id);
              }
            }}
            role="button"
            tabIndex={0}
          >
            <div className="card-header-line">
              <span className="card-label">{card.label}</span>
              <span className="card-icon">{card.icon}</span>
            </div>
            <div className="card-value">{card.count}</div>
          </div>
        );
      })}
    </div>
  );
}
