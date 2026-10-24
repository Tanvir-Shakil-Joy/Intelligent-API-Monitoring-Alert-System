import React from 'react';

export default function Filters({
  severity,
  onSeverityChange,
  apiName,
  onApiNameChange,
  onReset
}) {
  const severities = [
    { id: 'all', label: 'All Severities' },
    { id: 'critical', label: 'Critical' },
    { id: 'high', label: 'High' },
    { id: 'medium', label: 'Medium' }
  ];

  const hasActiveFilters = severity !== 'all' || apiName.trim().length > 0;

  return (
    <div className="filters-bar">
      <div className="filter-group">
        <label className="filter-label">Filter Severity:</label>
        <div className="filter-pills">
          {severities.map((s) => (
            <button
              key={s.id}
              className={`pill-btn ${severity === s.id ? 'active' : ''}`}
              onClick={() => onSeverityChange(s.id)}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      <div className="filter-group search-group">
        <label className="filter-label" htmlFor="api-search">Search API:</label>
        <input
          id="api-search"
          type="text"
          className="search-input"
          placeholder="e.g. AppointmentAPI..."
          value={apiName}
          onChange={(e) => onApiNameChange(e.target.value)}
        />
        {hasActiveFilters && (
          <button className="btn-clear" onClick={onReset} title="Clear all filters">
            Clear Filters
          </button>
        )}
      </div>
    </div>
  );
}
