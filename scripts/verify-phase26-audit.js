const http = require('http');

async function request(options, data = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => (body += chunk));
      res.on('end', () => {
        try {
          resolve({
            status: res.statusCode,
            headers: res.headers,
            data: body ? JSON.parse(body) : null,
            raw: body,
          });
        } catch (e) {
          resolve({
            status: res.statusCode,
            headers: res.headers,
            data: body,
            raw: body,
          });
        }
      });
    });
    req.on('error', reject);
    if (data) req.write(typeof data === 'string' ? data : JSON.stringify(data));
    req.end();
  });
}

async function login(email, password) {
  const res = await request(
    {
      hostname: 'localhost',
      port: 80,
      path: '/api/auth/login',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    },
    { email, password }
  );
  return res.data?.accessToken;
}

async function run() {
  console.log('=== PHASE 26 AUDIT LOG VERIFICATION ===\n');

  const adminToken = await login('admin@biotrack.in', 'BioTrack@2026');
  if (!adminToken) throw new Error('Failed to login as Super Admin');

  // 1. Trigger compliance rule update
  console.log('[Step 1] Updating SLA Compliance Rule...');
  const rulesRes = await request({
    hostname: 'localhost',
    port: 80,
    path: '/api/compliance-rules',
    method: 'GET',
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  const ruleId = rulesRes.data?.[0]?.id;
  if (!ruleId) throw new Error('No compliance rules found');

  const updateRuleRes = await request({
    hostname: 'localhost',
    port: 80,
    path: `/api/compliance-rules/${ruleId}`,
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${adminToken}`,
      'Content-Type': 'application/json',
    },
  }, { maxDurationHours: 48 });
  console.log('  -> Update Rule Status:', updateRuleRes.status);

  // 2. Trigger facility approval update
  console.log('[Step 2] Updating Facility Status...');
  const facRes = await request({
    hostname: 'localhost',
    port: 80,
    path: '/api/facilities/a13ef6cd-ed6c-4f95-8c49-3c5e781e9e74/approve',
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${adminToken}`,
      'Content-Type': 'application/json',
    },
  }, { action: 'APPROVED' });
  console.log('  -> Approve Facility Status:', facRes.status);

  // 3. Query Audit Logs via Super Admin API
  console.log('[Step 3] Fetching Audit Logs via GET /api/audit-log...');
  const auditLogsRes = await request({
    hostname: 'localhost',
    port: 80,
    path: '/api/audit-log',
    method: 'GET',
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  console.log('  -> Audit Logs API Status:', auditLogsRes.status);
  console.log('  -> Audit Logs Count:', auditLogsRes.data?.length);
  console.log('  -> Sample Audit Log Entries:');
  for (const log of (auditLogsRes.data || []).slice(0, 5)) {
    console.log(`     - [${log.action}] on ${log.entityType} (${log.entityId}) at ${log.occurredAt}`);
  }

  // 4. Verify Phase 25 batch integrity
  console.log('\n[Step 4] Verifying Phase 25 Batch BMW-2026-000022 Integrity...');
  const batchRes = await request({
    hostname: 'localhost',
    port: 80,
    path: '/api/waste-batches/8cea824b-ad67-45ad-954b-245bd58b97c7',
    method: 'GET',
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  console.log('  -> Batch Waste ID:', batchRes.data?.wasteId);
  console.log('  -> Batch Status  :', batchRes.data?.status);
  if (batchRes.data?.status !== 'VERIFIED_CLOSED') {
    throw new Error(`Batch status corrupted: ${batchRes.data?.status}`);
  }
  console.log('  ✅ Phase 25 Batch Integrity Confirmed (VERIFIED_CLOSED)');
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
