import React, { useState } from 'react';
import { submitMonitorBatch } from '../api/client';

// 1. Reference sample from task specification Section 5
const TASK_SAMPLE = [
  {
    "api_name": "PatientDataAPI",
    "response_time_ms": 1200,
    "status_code": 200,
    "records_returned": 50
  },
  {
    "api_name": "AppointmentAPI",
    "response_time_ms": 5500,
    "status_code": 500,
    "records_returned": 0
  }
];

// 2. Comprehensive edge case suite
const COMPREHENSIVE_SUITE = [
  {
    "api_name": "PatientDataAPI",
    "response_time_ms": 1200,
    "status_code": 200,
    "records_returned": 50
  },
  {
    "api_name": "AppointmentAPI",
    "response_time_ms": 5500,
    "status_code": 500,
    "records_returned": 0
  },
  {
    "api_name": "BillingAPI",
    "response_time_ms": 6200,
    "status_code": 200,
    "records_returned": 25
  },
  {
    "api_name": "LabResultsAPI",
    "response_time_ms": 350,
    "status_code": 200,
    "records_returned": null
  },
  {
    "api_name": "ProviderDirectoryAPI",
    "response_time_ms": 180,
    "status_code": 404,
    "records_returned": 0
  }
];

// 3. Mixed batch with malformed items to test partition logic
const PARTITION_TEST_SUITE = [
  {
    "api_name": "PrescriptionAPI",
    "response_time_ms": 3200,
    "status_code": 200,
    "records_returned": 10
  },
  {
    "api_name": "",
    "response_time_ms": "fast",
    "status_code": 999,
    "records_returned": -5
  }
];

export default function MonitorPanel({ onBatchCompleted, onClose }) {
  const [jsonText, setJsonText] = useState(JSON.stringify(TASK_SAMPLE, null, 2));
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [batchResult, setBatchResult] = useState(null);

  // Real-time client-side syntax validity check
  let isJsonValid = false;
  try {
    const parsed = JSON.parse(jsonText);
    isJsonValid = Array.isArray(parsed) && parsed.length > 0;
  } catch (_) {
    isJsonValid = false;
  }

  const handleApplyPreset = (preset) => {
    setJsonText(JSON.stringify(preset, null, 2));
    setErrorMessage('');
    setBatchResult(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage('');
    setBatchResult(null);

    let parsed;
    try {
      parsed = JSON.parse(jsonText);
    } catch (err) {
      setErrorMessage(`Invalid JSON syntax: ${err.message}`);
      return;
    }

    if (!Array.isArray(parsed)) {
      setErrorMessage('Validation error: Root payload must be a JSON array [...].');
      return;
    }

    if (parsed.length === 0) {
      setErrorMessage('Validation error: Array cannot be empty (HTTP 400 requirement).');
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await submitMonitorBatch(parsed);
      setBatchResult(response.summary);
      if (onBatchCompleted) {
        onBatchCompleted();
      }
    } catch (err) {
      setErrorMessage(err.message || 'Batch request failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="monitor-panel-card">
      <div className="panel-header">
        <div>
          <h2 className="panel-title">⚡ Interactive "Run Monitor" Test Panel</h2>
          <p className="panel-subtitle">
            Submit batches directly to <code>POST /monitor</code> to evaluate health, run AI alerts, and persist anomalies.
          </p>
        </div>
        <button className="btn-close" onClick={onClose} title="Close test panel">✕</button>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="editor-controls">
          <div className="preset-buttons">
            <span className="preset-label">Presets:</span>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => handleApplyPreset(TASK_SAMPLE)}
            >
              Task Sample (2 APIs)
            </button>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => handleApplyPreset(COMPREHENSIVE_SUITE)}
            >
              Full Anomaly Suite (5 APIs)
            </button>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => handleApplyPreset(PARTITION_TEST_SUITE)}
            >
              Malformed Partition Test
            </button>
          </div>

          <span className={`syntax-indicator ${isJsonValid ? 'valid' : 'invalid'}`}>
            {isJsonValid ? '● Valid Array' : '● Invalid JSON'}
          </span>
        </div>

        <textarea
          className="json-editor"
          rows={11}
          value={jsonText}
          onChange={(e) => setJsonText(e.target.value)}
          placeholder="[ { api_name: ... } ]"
          spellCheck={false}
        />

        {errorMessage && (
          <div className="panel-error-banner">
            <strong>Submission Rejected:</strong> {errorMessage}
          </div>
        )}

        {batchResult && (
          <div className="panel-summary-banner">
            <div className="banner-title-line">
              <h4>✅ Batch Evaluated Successfully</h4>
              <span className="duration-tag">{batchResult.durationMs} ms total</span>
            </div>
            <div className="summary-stat-row">
              <span>Processed: <strong>{batchResult.processed}</strong></span>
              <span>Healthy: <strong className="text-green">{batchResult.healthy}</strong></span>
              <span>Anomalies: <strong className="text-red">{batchResult.anomaliesDetected}</strong></span>
              <span>Alerts Saved: <strong>{batchResult.alertsCreated}</strong></span>
              <span>Invalid Partitioned: <strong>{batchResult.invalidItems}</strong></span>
              <span>Failures: <strong>{batchResult.failures}</strong></span>
            </div>
          </div>
        )}

        <div className="panel-footer">
          <button
            type="submit"
            className="btn btn-primary"
            disabled={isSubmitting || !isJsonValid}
          >
            {isSubmitting ? 'Evaluating & Running LLM Pipeline...' : '🚀 Submit Batch to POST /monitor'}
          </button>
        </div>
      </form>
    </div>
  );
}
