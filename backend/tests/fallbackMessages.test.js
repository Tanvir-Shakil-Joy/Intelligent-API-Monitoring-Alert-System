const { generateFallbackMessage } = require('../src/services/fallbackMessages');

describe('fallbackMessages (Deterministic Alert Message Generator Tests)', () => {
  // 1. Task Reference Example (500 + 0 records + 5500 ms)
  test('generates expected message for AppointmentAPI reference failure', () => {
    const input = {
      apiName: 'AppointmentAPI',
      anomalyTypes: ['SERVER_ERROR', 'ZERO_RECORDS', 'HIGH_RESPONSE_TIME'],
      metrics: {
        statusCode: 500,
        responseTimeMs: 5500,
        recordsReturned: 0
      }
    };

    const message = generateFallbackMessage(input);

    expect(message).toBe(
      'AppointmentAPI failed with status 500 in 5500 ms and returned 0 records. Possible outage or data issue.'
    );
  });

  // 2. Server Error with Missing/Null Records
  test('generates clear message for status 500 with null records_returned', () => {
    const input = {
      apiName: 'AppointmentAPI',
      anomalyTypes: ['SERVER_ERROR', 'ZERO_RECORDS'],
      metrics: {
        statusCode: 500,
        responseTimeMs: 800,
        recordsReturned: null
      }
    };

    const message = generateFallbackMessage(input);

    expect(message).toBe(
      'AppointmentAPI failed with status 500 in 800 ms and returned omitted record data. Possible outage or data issue.'
    );
  });

  // 3. Server Error Alone (5xx)
  test('generates clear message for server error alone', () => {
    const input = {
      apiName: 'PaymentGatewayAPI',
      anomalyTypes: ['SERVER_ERROR'],
      metrics: {
        statusCode: 503,
        responseTimeMs: 450,
        recordsReturned: 5
      }
    };

    const message = generateFallbackMessage(input);

    expect(message).toBe(
      'PaymentGatewayAPI failed with HTTP status 503 after 450 ms. Possible service outage or backend failure.'
    );
  });

  // 4. Client Error Alone (4xx)
  test('generates clear message for client error alone', () => {
    const input = {
      apiName: 'UsersAPI',
      anomalyTypes: ['CLIENT_ERROR'],
      metrics: {
        statusCode: 400,
        responseTimeMs: 120,
        recordsReturned: 2
      }
    };

    const message = generateFallbackMessage(input);

    expect(message).toBe(
      'UsersAPI returned client error status 400. Possible invalid request parameters or missing resource.'
    );
  });

  // 5. Client Error with Zero Records (404 Not Found)
  test('generates clear message for 404 client error with 0 records', () => {
    const input = {
      apiName: 'ProviderDirectoryAPI',
      anomalyTypes: ['CLIENT_ERROR', 'ZERO_RECORDS'],
      metrics: {
        statusCode: 404,
        responseTimeMs: 180,
        recordsReturned: 0
      }
    };

    const message = generateFallbackMessage(input);

    expect(message).toBe(
      'ProviderDirectoryAPI returned client error status 404 with no records returned. Possible invalid request parameters or missing resource.'
    );
  });

  // 6. High Response Time Alone (Records Present)
  test('generates clear message for high response time when records are returned', () => {
    const input = {
      apiName: 'PatientDataAPI',
      anomalyTypes: ['HIGH_RESPONSE_TIME'],
      metrics: {
        statusCode: 200,
        responseTimeMs: 8200,
        recordsReturned: 50
      }
    };

    const message = generateFallbackMessage(input);

    expect(message).toBe(
      'PatientDataAPI responded successfully with 50 records but took 8200 ms, well above normal. Possible performance degradation or upstream load.'
    );
  });

  // 7. High Response Time with Missing Records
  test('generates clear message for latency combined with missing records', () => {
    const input = {
      apiName: 'SearchAPI',
      anomalyTypes: ['HIGH_RESPONSE_TIME', 'ZERO_RECORDS'],
      metrics: {
        statusCode: 200,
        responseTimeMs: 6100,
        recordsReturned: null
      }
    };

    const message = generateFallbackMessage(input);

    expect(message).toBe(
      'SearchAPI took 6100 ms and returned omitted record data. Possible slow query or data retrieval issue.'
    );
  });

  // 8. Zero Records Alone (Status 200)
  test('generates clear message for 0 records returned on 200 OK', () => {
    const input = {
      apiName: 'InventoryAPI',
      anomalyTypes: ['ZERO_RECORDS'],
      metrics: {
        statusCode: 200,
        responseTimeMs: 250,
        recordsReturned: 0
      }
    };

    const message = generateFallbackMessage(input);

    expect(message).toBe(
      'InventoryAPI responded successfully with status 200 but returned 0 records. Possible empty dataset or querying issue.'
    );
  });

  // 9. Null Records Alone (Status 200)
  test('generates clear message for null/omitted records on 200 OK', () => {
    const input = {
      apiName: 'LabResultsAPI',
      anomalyTypes: ['ZERO_RECORDS'],
      metrics: {
        statusCode: 200,
        responseTimeMs: 310,
        recordsReturned: null
      }
    };

    const message = generateFallbackMessage(input);

    expect(message).toBe(
      'LabResultsAPI responded with status 200 but omitted record data. Possible data serialization issue.'
    );
  });

  // 10. Robustness & Fallback Default
  test('never throws on empty arguments and produces sensible default fallback', () => {
    expect(() => generateFallbackMessage()).not.toThrow();
    expect(generateFallbackMessage({})).toContain('Monitored API triggered operational warnings');
  });
});
