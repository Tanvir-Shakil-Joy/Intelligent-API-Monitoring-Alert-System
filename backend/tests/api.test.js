const request = require('supertest');
const app = require('../src/app');

describe('API Endpoints Integration Tests', () => {
  describe('GET /health', () => {
    test('returns 200 OK with health status', async () => {
      const res = await request(app).get('/health');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.status).toBe('ok');
    });

    test('returns 200 OK via /api/health', async () => {
      const res = await request(app).get('/api/health');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  describe('POST /monitor', () => {
    test('rejects empty batch with 400 Bad Request', async () => {
      const res = await request(app)
        .post('/monitor')
        .send([]);
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    test('rejects non-array body with 400 Bad Request', async () => {
      const res = await request(app)
        .post('/monitor')
        .send({ api_name: 'SingleItem' });
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    test('successfully processes batch input and creates alerts', async () => {
      const batchInput = [
        {
          api_name: 'PatientDataAPI',
          response_time_ms: 1200,
          status_code: 200,
          records_returned: 50
        },
        {
          api_name: 'AppointmentAPI',
          response_time_ms: 5500,
          status_code: 500,
          records_returned: 0
        }
      ];

      const res = await request(app)
        .post('/monitor')
        .send(batchInput);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.summary).toBeDefined();
      expect(res.body.summary.processed).toBe(2);
      expect(res.body.summary.healthy).toBe(1);
      expect(res.body.summary.anomaliesDetected).toBe(1);
      expect(res.body.summary.alertsCreated).toBe(1);
      expect(res.body.alerts).toHaveLength(1);
      expect(res.body.alerts[0].apiName).toBe('AppointmentAPI');
      expect(res.body.alerts[0].severity).toBe('critical');
    });

    test('partitions invalid items without failing the entire batch', async () => {
      const mixedBatch = [
        {
          api_name: 'ValidHealthyAPI',
          response_time_ms: 100,
          status_code: 200,
          records_returned: 10
        },
        {
          api_name: '', // Invalid empty name
          response_time_ms: -50, // Invalid negative latency
          status_code: 999 // Invalid HTTP status
        }
      ];

      const res = await request(app)
        .post('/monitor')
        .send(mixedBatch);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.summary.processed).toBe(1);
      expect(res.body.summary.invalidItems).toBe(1);
    });
  });

  describe('GET /alerts', () => {
    test('fetches active alerts sorted by createdAt descending', async () => {
      const res = await request(app).get('/alerts');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.count).toBe(res.body.data.length);
    });

    test('filters alerts by severity', async () => {
      const res = await request(app).get('/alerts?severity=critical');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      res.body.data.forEach((alert) => {
        expect(alert.severity).toBe('critical');
      });
    });

    test('filters alerts by apiName', async () => {
      const res = await request(app).get('/alerts?apiName=AppointmentAPI');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      res.body.data.forEach((alert) => {
        expect(alert.apiName).toBe('AppointmentAPI');
      });
    });

    test('handles object or array query parameters safely without throwing', async () => {
      const res = await request(app).get('/alerts?apiName[regex]=.*&severity[]=critical');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
    });
  });

  describe('404 Not Found', () => {
    test('returns standard 404 JSON for undefined routes', async () => {
      const res = await request(app).get('/api/non-existent-route-for-testing');
      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('NOT_FOUND');
    });
  });
});
