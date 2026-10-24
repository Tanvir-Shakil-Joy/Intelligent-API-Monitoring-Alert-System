import React, { useState, useEffect, useCallback, useRef } from 'react';
import Header from './components/Header';
import SummaryCards from './components/SummaryCards';
import Filters from './components/Filters';
import AlertList from './components/AlertList';
import MonitorPanel from './components/MonitorPanel';
import { fetchAlerts, checkSystemHealth } from './api/client';
import './styles/main.css';

const REFRESH_INTERVAL_SEC = 15;

export default function App() {
  const [alerts, setAlerts] = useState([]);
  const [counts, setCounts] = useState({ total: 0, critical: 0, high: 0, medium: 0 });
  const [severityFilter, setSeverityFilter] = useState('all');
  const [apiNameFilter, setApiNameFilter] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [isOnline, setIsOnline] = useState(true);
  const [countdown, setCountdown] = useState(REFRESH_INTERVAL_SEC);
  const [showMonitorPanel, setShowMonitorPanel] = useState(false);

  const countdownTimerRef = useRef(null);

  // Load alerts and calculate global summary counts
  const loadAlerts = useCallback(async (isBackground = false) => {
    if (!isBackground) {
      setIsRefreshing(true);
    }
    setErrorMessage('');

    try {
      // Fetch filtered alerts and global baseline concurrently
      const [res, allRes] = await Promise.all([
        fetchAlerts({
          severity: severityFilter,
          apiName: apiNameFilter
        }),
        fetchAlerts({})
      ]);

      setAlerts(res.data || []);

      const allData = allRes.data || [];
      const computedCounts = {
        total: allData.length,
        critical: allData.filter((a) => a.severity === 'critical').length,
        high: allData.filter((a) => a.severity === 'high').length,
        medium: allData.filter((a) => a.severity === 'medium').length
      };
      setCounts(computedCounts);
      setIsOnline(true);
    } catch (err) {
      setErrorMessage(err.message || 'Failed to connect to monitoring service');
      setIsOnline(false);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
      setCountdown(REFRESH_INTERVAL_SEC);
    }
  }, [severityFilter, apiNameFilter]);

  // Initial load and filter change trigger
  useEffect(() => {
    loadAlerts(false);
  }, [loadAlerts]);

  // Periodic health check & countdown
  useEffect(() => {
    countdownTimerRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          loadAlerts(true);
          return REFRESH_INTERVAL_SEC;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
    };
  }, [loadAlerts]);

  const handleResetFilters = () => {
    setSeverityFilter('all');
    setApiNameFilter('');
  };

  return (
    <div className="app-container">
      <Header
        isOnline={isOnline}
        countdown={countdown}
        onRefresh={() => loadAlerts(false)}
        isRefreshing={isRefreshing}
        showMonitorPanel={showMonitorPanel}
        onToggleMonitorPanel={() => setShowMonitorPanel((prev) => !prev)}
      />

      <main className="app-main">
        {showMonitorPanel && (
          <MonitorPanel
            onBatchCompleted={() => loadAlerts(false)}
            onClose={() => setShowMonitorPanel(false)}
          />
        )}

        <SummaryCards
          counts={counts}
          activeSeverity={severityFilter}
          onSelectSeverity={(sev) => setSeverityFilter(sev)}
        />

        <div className="content-card">
          <Filters
            severity={severityFilter}
            onSeverityChange={(sev) => setSeverityFilter(sev)}
            apiName={apiNameFilter}
            onApiNameChange={(name) => setApiNameFilter(name)}
            onReset={handleResetFilters}
          />

          <AlertList
            alerts={alerts}
            isLoading={isLoading}
            error={errorMessage}
            onRetry={() => loadAlerts(false)}
          />
        </div>
      </main>

      <footer className="app-footer">
        <p>Intelligent API Monitoring & Alert System • Powered by Google Antigravity & LLM Intelligence</p>
      </footer>
    </div>
  );
}
