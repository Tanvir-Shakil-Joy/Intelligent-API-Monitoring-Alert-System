const {
  detectAnomalies,
  resolveOverallSeverity,
  ANOMALY_TYPES,
  SEVERITIES
} = require('../src/services/anomalyService');

describe('anomalyService (Rules Engine Unit Tests)', () => {
  const options = { slowThresholdMs: 3000, verySlowThresholdMs: 5000 };

  // 1. Healthy Response
  test('returns isAnomaly: false and null severity for healthy API response', () => {
    const input = {
      api_name: 'PatientDataAPI',
      response_time_ms: 1200,
      status_code: 200,
      records_returned: 50
    };

    const result = detectAnomalies(input, options);

    expect(result.apiName).toBe('PatientDataAPI');
    expect(result.isAnomaly).toBe(false);
    expect(result.severity).toBeNull();
    expect(result.anomalyTypes).toEqual([]);
    expect(result.anomalies).toHaveLength(0);
    expect(result.metrics).toEqual({
      responseTimeMs: 1200,
      statusCode: 200,
      recordsReturned: 50
    });
  });

  // 2. High Response Time Alone
  describe('High response time thresholds', () => {
    test('triggers medium severity HIGH_RESPONSE_TIME when response_time_ms > 3000ms and <= 5000ms', () => {
      const input = {
        api_name: 'SearchAPI',
        response_time_ms: 3200,
        status_code: 200,
        records_returned: 15
      };

      const result = detectAnomalies(input, options);

      expect(result.isAnomaly).toBe(true);
      expect(result.severity).toBe(SEVERITIES.MEDIUM);
      expect(result.anomalyTypes).toEqual([ANOMALY_TYPES.HIGH_RESPONSE_TIME]);
    });

    test('triggers high severity HIGH_RESPONSE_TIME when response_time_ms > 5000ms', () => {
      const input = {
        api_name: 'ReportsAPI',
        response_time_ms: 5200,
        status_code: 200,
        records_returned: 15
      };

      const result = detectAnomalies(input, options);

      expect(result.isAnomaly).toBe(true);
      expect(result.severity).toBe(SEVERITIES.HIGH);
      expect(result.anomalyTypes).toEqual([ANOMALY_TYPES.HIGH_RESPONSE_TIME]);
    });

    test('treats response times at exactly the threshold boundary correctly', () => {
      // Exactly 3000ms is not strictly greater than 3000ms
      const boundaryNormal = detectAnomalies(
        { api_name: 'API', response_time_ms: 3000, status_code: 200, records_returned: 10 },
        options
      );
      expect(boundaryNormal.isAnomaly).toBe(false);

      // Exactly 5000ms is medium severity (> 3000 and <= 5000)
      const boundaryMedium = detectAnomalies(
        { api_name: 'API', response_time_ms: 5000, status_code: 200, records_returned: 10 },
        options
      );
      expect(boundaryMedium.severity).toBe(SEVERITIES.MEDIUM);
    });
  });

  // 3. Server Error Alone
  describe('Server errors (500–599)', () => {
    test.each([500, 502, 503, 504, 599])('triggers critical severity SERVER_ERROR for status %i', (statusCode) => {
      const input = {
        api_name: 'AuthAPI',
        response_time_ms: 200,
        status_code: statusCode,
        records_returned: 1
      };

      const result = detectAnomalies(input, options);

      expect(result.isAnomaly).toBe(true);
      expect(result.severity).toBe(SEVERITIES.CRITICAL);
      expect(result.anomalyTypes).toContain(ANOMALY_TYPES.SERVER_ERROR);
    });
  });

  // 4. Client Error Alone
  describe('Client errors (400–499)', () => {
    test.each([400, 401, 403, 404, 429])('triggers medium severity CLIENT_ERROR for status %i', (statusCode) => {
      const input = {
        api_name: 'DirectoryAPI',
        response_time_ms: 150,
        status_code: statusCode,
        records_returned: 1
      };

      const result = detectAnomalies(input, options);

      expect(result.isAnomaly).toBe(true);
      expect(result.severity).toBe(SEVERITIES.MEDIUM);
      expect(result.anomalyTypes).toEqual([ANOMALY_TYPES.CLIENT_ERROR]);
    });
  });

  // 5. Zero Records
  describe('Zero records returned', () => {
    test('triggers high severity ZERO_RECORDS when records_returned is 0', () => {
      const input = {
        api_name: 'CatalogAPI',
        response_time_ms: 250,
        status_code: 200,
        records_returned: 0
      };

      const result = detectAnomalies(input, options);

      expect(result.isAnomaly).toBe(true);
      expect(result.severity).toBe(SEVERITIES.HIGH);
      expect(result.anomalyTypes).toEqual([ANOMALY_TYPES.ZERO_RECORDS]);
    });
  });

  // 6. Missing / Null / Undefined Records
  describe('Missing or null records', () => {
    test('triggers high severity ZERO_RECORDS when records_returned is null', () => {
      const input = {
        api_name: 'LabResultsAPI',
        response_time_ms: 250,
        status_code: 200,
        records_returned: null
      };

      const result = detectAnomalies(input, options);

      expect(result.isAnomaly).toBe(true);
      expect(result.severity).toBe(SEVERITIES.HIGH);
      expect(result.anomalyTypes).toEqual([ANOMALY_TYPES.ZERO_RECORDS]);
      expect(result.metrics.recordsReturned).toBeNull();
    });

    test('triggers high severity ZERO_RECORDS when records_returned is omitted/undefined', () => {
      const input = {
        api_name: 'PrescriptionAPI',
        response_time_ms: 250,
        status_code: 200
      };

      const result = detectAnomalies(input, options);

      expect(result.isAnomaly).toBe(true);
      expect(result.severity).toBe(SEVERITIES.HIGH);
      expect(result.anomalyTypes).toEqual([ANOMALY_TYPES.ZERO_RECORDS]);
      expect(result.metrics.recordsReturned).toBeNull();
    });
  });

  // 7. Multiple Simultaneous Anomalies
  describe('Compound anomalies', () => {
    test('detects all three anomalies for AppointmentAPI (500 + 0 records + 5500ms)', () => {
      const input = {
        api_name: 'AppointmentAPI',
        response_time_ms: 5500,
        status_code: 500,
        records_returned: 0
      };

      const result = detectAnomalies(input, options);

      expect(result.isAnomaly).toBe(true);
      expect(result.severity).toBe(SEVERITIES.CRITICAL);
      expect(result.anomalyTypes).toEqual(
        expect.arrayContaining([
          ANOMALY_TYPES.SERVER_ERROR,
          ANOMALY_TYPES.HIGH_RESPONSE_TIME,
          ANOMALY_TYPES.ZERO_RECORDS
        ])
      );
      expect(result.anomalyTypes).toHaveLength(3);
    });
  });

  // 8. Severity Escalation (Highest Severity Wins)
  describe('Severity escalation hierarchy (critical > high > medium)', () => {
    test('resolveOverallSeverity correctly ranks severities', () => {
      expect(resolveOverallSeverity(['medium', 'high'])).toBe(SEVERITIES.HIGH);
      expect(resolveOverallSeverity(['medium', 'critical', 'high'])).toBe(SEVERITIES.CRITICAL);
      expect(resolveOverallSeverity(['medium'])).toBe(SEVERITIES.MEDIUM);
      expect(resolveOverallSeverity([])).toBeNull();
    });

    test('escalates to high when combining CLIENT_ERROR (medium) with ZERO_RECORDS (high)', () => {
      const input = {
        api_name: 'ProviderAPI',
        response_time_ms: 100,
        status_code: 404,
        records_returned: 0
      };

      const result = detectAnomalies(input, options);

      expect(result.severity).toBe(SEVERITIES.HIGH);
      expect(result.anomalyTypes).toEqual(
        expect.arrayContaining([ANOMALY_TYPES.CLIENT_ERROR, ANOMALY_TYPES.ZERO_RECORDS])
      );
    });

    test('escalates to critical when combining SERVER_ERROR (critical) with HIGH_RESPONSE_TIME (medium)', () => {
      const input = {
        api_name: 'PaymentAPI',
        response_time_ms: 3500,
        status_code: 503,
        records_returned: 5
      };

      const result = detectAnomalies(input, options);

      expect(result.severity).toBe(SEVERITIES.CRITICAL);
    });
  });
});
