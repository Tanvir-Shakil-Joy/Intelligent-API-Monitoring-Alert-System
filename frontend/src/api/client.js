const BASE_URL = import.meta.env.VITE_API_URL || '';

/**
 * Normalizes API endpoint URLs ensuring correct prefixing.
 */
function buildUrl(endpoint, params = {}) {
  const originOrBase = BASE_URL || window.location.origin;
  const cleanBase = originOrBase.replace(/\/+$/, '');
  const cleanEndpoint = endpoint.replace(/^\/+/, '');
  const url = new URL(`${cleanBase}/${cleanEndpoint}`);
  Object.entries(params).forEach(([key, val]) => {
    if (val !== undefined && val !== null && val !== '' && val !== 'all') {
      url.searchParams.append(key, val);
    }
  });
  return url.toString();
}

/**
 * Fetches active alerts from GET /alerts with optional severity and apiName filters.
 */
export async function fetchAlerts(filters = {}) {
  const url = buildUrl('/alerts', filters);
  const response = await fetch(url, {
    headers: {
      Accept: 'application/json'
    }
  });

  if (!response.ok) {
    const errorJson = await response.json().catch(() => ({}));
    throw new Error(errorJson?.error?.message || `Failed to fetch alerts (HTTP ${response.status})`);
  }

  return await response.json();
}

/**
 * Submits a batch of monitored API responses to POST /monitor.
 */
export async function submitMonitorBatch(items) {
  const url = buildUrl('/monitor');
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json'
    },
    body: JSON.stringify(items)
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data?.error?.message || `Batch monitoring failed (HTTP ${response.status})`);
  }

  return data;
}

/**
 * Checks system health via GET /health.
 */
export async function checkSystemHealth() {
  const url = buildUrl('/health');
  const response = await fetch(url);
  if (!response.ok) throw new Error('Health check failed');
  return await response.json();
}
