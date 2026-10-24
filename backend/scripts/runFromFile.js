const fs = require('fs');
const path = require('path');
const env = require('../src/config/env');
const { connectDB, disconnectDB } = require('../src/config/db');
const { processBatch } = require('../src/services/monitorService');
const { batchArraySchema, itemSchema } = require('../src/middleware/validateInput');

async function run() {
  console.log('\n========================================================');
  console.log('  🔍 Intelligent API Monitoring System — File Runner    ');
  console.log('========================================================\n');

  // 1. Resolve target file path
  let targetPath = process.argv[2];
  if (!targetPath) {
    targetPath = path.resolve(__dirname, '../data/sample-input.json');
    if (!fs.existsSync(targetPath)) {
      targetPath = path.resolve(process.cwd(), 'data/sample-input.json');
    }
  } else {
    targetPath = path.resolve(process.cwd(), targetPath);
  }

  if (!fs.existsSync(targetPath)) {
    console.error(`❌ Error: Input file not found at: ${targetPath}`);
    process.exit(1);
  }

  console.log(`📁 Reading input from: ${targetPath}`);

  // 2. Read and parse JSON content
  let rawData;
  try {
    const fileContent = fs.readFileSync(targetPath, 'utf8');
    rawData = JSON.parse(fileContent);
  } catch (err) {
    console.error(`❌ Error parsing JSON file: ${err.message}`);
    process.exit(1);
  }

  // 3. Validate root batch array
  const { error: batchError } = batchArraySchema.validate(rawData);
  if (batchError) {
    console.error(`❌ Validation Error: ${batchError.details.map((d) => d.message).join('; ')}`);
    process.exit(1);
  }

  // 4. Partition items
  const validItems = [];
  const invalidItems = [];

  rawData.forEach((item, index) => {
    const { value, error } = itemSchema.validate(item, { abortEarly: false });
    if (error) {
      invalidItems.push({ index, item, errors: error.details.map((d) => d.message) });
    } else {
      validItems.push({
        api_name: value.api_name,
        response_time_ms: value.response_time_ms,
        status_code: value.status_code,
        ...(value.records_returned !== undefined && { records_returned: value.records_returned })
      });
    }
  });

  console.log(`📊 Validated: ${validItems.length} valid item(s), ${invalidItems.length} invalid item(s).`);

  // 5. Connect to Database
  try {
    await connectDB(env.MONGO_URI);
  } catch (err) {
    console.error(`❌ Database Connection Failed: ${err.message}`);
    process.exit(1);
  }

  // 6. Execute Batch Pipeline
  const requestId = 'cli-' + Date.now().toString(36);
  let result;
  try {
    result = await processBatch({
      validItems,
      invalidItems,
      requestId
    });
  } catch (err) {
    console.error(`❌ Batch processing pipeline error: ${err.message}`);
    await disconnectDB();
    process.exit(1);
  }

  // 7. Output Human-Readable Summary
  const { summary, alerts } = result;

  console.log('\n--------------------------------------------------------');
  console.log('  📈 BATCH PROCESSING SUMMARY                           ');
  console.log('--------------------------------------------------------');
  console.log(`  Total Processed    : ${summary.processed}`);
  console.log(`  Healthy APIs       : ${summary.healthy}`);
  console.log(`  Anomalies Detected : ${summary.anomaliesDetected}`);
  console.log(`  Alerts Persisted   : ${summary.alertsCreated}`);
  console.log(`  Invalid Payload    : ${summary.invalidItems}`);
  console.log(`  Failures / Errors  : ${summary.failures}`);
  console.log(`  Total Duration     : ${summary.durationMs} ms`);
  console.log('--------------------------------------------------------\n');

  if (alerts && alerts.length > 0) {
    console.log('🚨 PERSISTED ACTIVE ALERTS:');
    alerts.forEach((alert, i) => {
      const severityColor = alert.severity === 'critical' ? '🔴 CRITICAL' : (alert.severity === 'high' ? '🟠 HIGH' : '🟡 MEDIUM');
      console.log(`\n  [${i + 1}] ${severityColor} - ${alert.apiName}`);
      console.log(`      Types   : ${alert.anomalyTypes ? alert.anomalyTypes.join(', ') : 'N/A'}`);
      console.log(`      Metrics : Status ${alert.metrics.statusCode} | ${alert.metrics.responseTimeMs}ms | ${alert.metrics.recordsReturned !== null ? alert.metrics.recordsReturned : 'N/A'} records`);
      console.log(`      Source  : [${alert.messageSource.toUpperCase()}]`);
      console.log(`      Message : "${alert.message}"`);
      console.log(`      ID      : ${alert.id}`);
    });
    console.log('');
  } else {
    console.log('✅ All monitored APIs are healthy. No anomalies detected.\n');
  }

  if (invalidItems.length > 0) {
    console.log('⚠️  INVALID ITEMS PARTITIONED:');
    invalidItems.forEach((inv) => {
      console.log(`  Index ${inv.index}: ${inv.errors.join('; ')}`);
    });
    console.log('');
  }

  // 8. Graceful Disconnect
  await disconnectDB();
  console.log('✨ Batch file run completed successfully.\n');
  process.exit(0);
}

run().catch(async (err) => {
  console.error('Fatal CLI Error:', err);
  try {
    await disconnectDB();
  } catch (_) {
    // Ignore secondary disconnect errors on exit
  }
  process.exit(1);
});
