const nodemailer = require('nodemailer');
const env = require('../config/env');
const logger = require('../utils/logger');

let transporter = null;

function getTransporter() {
  if (!transporter && env.EMAIL_ENABLED && env.SMTP_HOST) {
    transporter = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_PORT === 465,
      auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASS } : undefined
    });
  }
  return transporter;
}

/**
 * Builds an HTML email digest for newly created critical or high severity alerts.
 */
function buildEmailHtml(alerts, summary) {
  const rows = alerts
    .map(
      (a) => `
      <tr style="border-bottom: 1px solid #e2e8f0;">
        <td style="padding: 10px; font-weight: bold;">${a.apiName}</td>
        <td style="padding: 10px;"><span style="color: ${a.severity === 'critical' ? '#e53e3e' : '#dd6b20'}; text-transform: uppercase; font-weight: bold;">${a.severity}</span></td>
        <td style="padding: 10px;">${a.anomalyTypes ? a.anomalyTypes.join(', ') : 'N/A'}</td>
        <td style="padding: 10px;">${a.metrics.statusCode} / ${a.metrics.responseTimeMs}ms / ${a.metrics.recordsReturned !== null ? a.metrics.recordsReturned : 'N/A'} rec</td>
        <td style="padding: 10px;">${a.message}</td>
      </tr>`
    )
    .join('');

  return `
    <div style="font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; color: #2d3748;">
      <h2 style="color: #c53030;">⚠️ API Anomaly Alert Digest</h2>
      <p>The Intelligent API Monitoring System detected <strong>${alerts.length}</strong> operational anomaly/anomalies requiring attention.</p>
      
      <div style="background-color: #f7fafc; padding: 12px; border-radius: 6px; margin-bottom: 16px;">
        <strong>Batch Summary:</strong> ${summary.processed} processed, ${summary.anomaliesDetected} anomalies, ${summary.alertsCreated} alerts created in ${summary.durationMs}ms.
      </div>

      <table style="width: 100%; border-collapse: collapse; text-align: left; font-size: 14px;">
        <thead>
          <tr style="background-color: #edf2f7;">
            <th style="padding: 10px;">API Name</th>
            <th style="padding: 10px;">Severity</th>
            <th style="padding: 10px;">Types</th>
            <th style="padding: 10px;">Metrics (Status / Latency / Records)</th>
            <th style="padding: 10px;">Message</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
      </table>
      <p style="margin-top: 20px; font-size: 12px; color: #718096;">Generated automatically by Intelligent API Monitoring System.</p>
    </div>
  `;
}

/**
 * Sends an email alert digest for critical and high severity anomalies.
 * Guaranteed never to throw or block the caller.
 *
 * @param {Array<object>} newAlerts - Array of alert objects created in current batch
 * @param {object} summary - Batch summary
 */
async function sendAlertDigest(newAlerts, summary) {
  if (!env.EMAIL_ENABLED) {
    return;
  }

  // Only trigger email for critical or high severity alerts
  const priorityAlerts = (newAlerts || []).filter(
    (a) => a.severity === 'critical' || a.severity === 'high'
  );

  if (priorityAlerts.length === 0) {
    return;
  }

  if (!env.ALERT_RECIPIENT_EMAIL) {
    logger.warn('[Email Service] EMAIL_ENABLED is true but ALERT_RECIPIENT_EMAIL is not configured. Skipping email.');
    return;
  }

  try {
    const transport = getTransporter();
    if (!transport) {
      logger.warn('[Email Service] SMTP configuration missing. Skipping email.');
      return;
    }

    const mailOptions = {
      from: env.SMTP_FROM,
      to: env.ALERT_RECIPIENT_EMAIL,
      subject: `🚨 [${priorityAlerts[0].severity.toUpperCase()}] API Anomaly Alert: ${priorityAlerts.length} issues detected`,
      html: buildEmailHtml(priorityAlerts, summary)
    };

    const info = await transport.sendMail(mailOptions);
    logger.info(`[Email Service] Sent anomaly digest to ${env.ALERT_RECIPIENT_EMAIL} (MessageId: ${info.messageId})`);
  } catch (error) {
    // Non-blocking: log error and let HTTP request proceed
    logger.error(`[Email Service] Failed to send email digest: ${error.message}`);
  }
}

module.exports = {
  sendAlertDigest,
  buildEmailHtml
};
