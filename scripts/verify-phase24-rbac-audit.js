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
  return { token: res.data?.accessToken, user: res.data?.user, status: res.status, raw: res.raw };
}

const RESULTS = [];

function recordResult(testGroup, scenario, role, expected, actual, passed, details = '') {
  RESULTS.push({
    testGroup,
    scenario,
    role,
    expected,
    actual,
    passed,
    details,
  });
  const icon = passed ? '✅ PASS' : '❌ FAIL';
  console.log(`[${icon}] [${role}] ${scenario} | Expected: ${expected} | Actual: ${actual} ${details ? '(' + details + ')' : ''}`);
}

async function runAudit() {
  console.log('================================================================');
  console.log('PHASE 24 — COMPLETE REAL-USER RBAC & FACILITY-ISOLATION AUDIT');
  console.log('================================================================\n');

  // 1. Authenticate All 7 Authorized Roles
  console.log('--- Step 1: Authenticating All 7 Authorized Roles ---');
  const credentials = {
    HOSPITAL_ADMIN: { email: 'admin@citygeneral.in', pass: 'BioTrack@2026' },
    HOSPITAL_STAFF: { email: 'staff@citygeneral.in', pass: 'BioTrack@2026' },
    COLLECTION_STAFF: { email: 'collection@biotrack.in', pass: 'BioTrack@2026' },
    TRANSPORT_PERSONNEL: { email: 'transport@biotrack.in', pass: 'BioTrack@2026' },
    TREATMENT_FACILITY_STAFF: { email: 'facility@greendispose.in', pass: 'BioTrack@2026' },
    GOVERNMENT_AUTHORITY: { email: 'gov@mpcb.gov.in', pass: 'BioTrack@2026' },
    SUPER_ADMIN: { email: 'admin@biotrack.in', pass: 'BioTrack@2026' },
  };

  const tokens = {};
  for (const [roleKey, cred] of Object.entries(credentials)) {
    const authRes = await login(cred.email, cred.pass);
    if (authRes.token) {
      tokens[roleKey] = authRes.token;
      recordResult('AUTHENTICATION', `Login for ${cred.email}`, roleKey, '200 OK', `${authRes.status}`, true);
    } else {
      recordResult('AUTHENTICATION', `Login for ${cred.email}`, roleKey, '200 OK', `${authRes.status}`, false, authRes.raw);
    }
  }

  // 2. Auth Context & Me Endpoint
  console.log('\n--- Step 2: Validating Server-Side Identity (/api/users/me) ---');
  for (const [roleKey, token] of Object.entries(tokens)) {
    const meRes = await request({
      hostname: 'localhost',
      port: 80,
      path: '/api/users/me',
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` },
    });
    const isMatch = meRes.status === 200 && meRes.data?.role === roleKey;
    recordResult('IDENTITY', `Server-Side JWT context for ${roleKey}`, roleKey, `Role: ${roleKey}`, `Role: ${meRes.data?.role} (${meRes.status})`, isMatch);
  }

  // Fetch a category ID for tests
  const catRes = await request({
    hostname: 'localhost',
    port: 80,
    path: '/api/waste-categories',
    method: 'GET',
    headers: { Authorization: `Bearer ${tokens.SUPER_ADMIN}` },
  });
  const categoryId = Array.isArray(catRes.data) && catRes.data.length > 0 ? catRes.data[0].id : null;

  // 3. HOSPITAL_ADMIN RBAC & Boundary Tests
  console.log('\n--- Step 3: Testing HOSPITAL_ADMIN ---');
  {
    const token = tokens.HOSPITAL_ADMIN;
    // Allowed: Hospital Dashboard
    const r1 = await request({ hostname: 'localhost', port: 80, path: '/api/dashboard/hospital', method: 'GET', headers: { Authorization: `Bearer ${token}` } });
    recordResult('HOSPITAL_ADMIN', 'Access Hospital Dashboard', 'HOSPITAL_ADMIN', '200 OK', `${r1.status}`, r1.status === 200);

    // Allowed: User Directory of Own Facility
    const r2 = await request({ hostname: 'localhost', port: 80, path: '/api/users', method: 'GET', headers: { Authorization: `Bearer ${token}` } });
    recordResult('HOSPITAL_ADMIN', 'Access Hospital Staff Directory', 'HOSPITAL_ADMIN', '200 OK', `${r2.status}`, r2.status === 200);

    // Forbidden: Access Facility Dashboard
    const r3 = await request({ hostname: 'localhost', port: 80, path: '/api/dashboard/facility', method: 'GET', headers: { Authorization: `Bearer ${token}` } });
    recordResult('HOSPITAL_ADMIN', 'Access Treatment Facility Dashboard', 'HOSPITAL_ADMIN', '403 Forbidden', `${r3.status}`, r3.status === 403);

    // Forbidden: Access Government Dashboard
    const r4 = await request({ hostname: 'localhost', port: 80, path: '/api/dashboard/government', method: 'GET', headers: { Authorization: `Bearer ${token}` } });
    recordResult('HOSPITAL_ADMIN', 'Access Government Dashboard', 'HOSPITAL_ADMIN', '403 Forbidden', `${r4.status}`, r4.status === 403);

    // Forbidden: Access Audit Log
    const r5 = await request({ hostname: 'localhost', port: 80, path: '/api/audit-log', method: 'GET', headers: { Authorization: `Bearer ${token}` } });
    recordResult('HOSPITAL_ADMIN', 'Access System Audit Log', 'HOSPITAL_ADMIN', '403 Forbidden', `${r5.status}`, r5.status === 403);

    // Forbidden: Provision SUPER_ADMIN user
    const r6 = await request({
      hostname: 'localhost', port: 80, path: '/api/users', method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    }, { name: 'Rogue Admin', email: `rogue.${Date.now()}@biotrack.in`, password: 'Password@123', role: 'SUPER_ADMIN' });
    recordResult('HOSPITAL_ADMIN', 'Attempt to Provision SUPER_ADMIN', 'HOSPITAL_ADMIN', '403 Forbidden', `${r6.status}`, r6.status === 403);
  }

  // 4. HOSPITAL_STAFF RBAC & Boundary Tests
  console.log('\n--- Step 4: Testing HOSPITAL_STAFF ---');
  let createdBatchId = null;
  {
    const token = tokens.HOSPITAL_STAFF;
    // Allowed: Hospital Dashboard
    const r1 = await request({ hostname: 'localhost', port: 80, path: '/api/dashboard/hospital', method: 'GET', headers: { Authorization: `Bearer ${token}` } });
    recordResult('HOSPITAL_STAFF', 'Access Hospital Dashboard', 'HOSPITAL_STAFF', '200 OK', `${r1.status}`, r1.status === 200);

    // Allowed: Create Waste Batch
    const r2 = await request({
      hostname: 'localhost', port: 80, path: '/api/waste-batches', method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    }, { categoryId, department: 'Surgery Ward', quantity: 12.5, unit: 'KG' });
    createdBatchId = r2.data?.id;
    recordResult('HOSPITAL_STAFF', 'Create Waste Batch in Hospital', 'HOSPITAL_STAFF', '201 Created', `${r2.status}`, r2.status === 201);

    // Allowed: Generate QR Code for own batch
    if (createdBatchId) {
      const qrRes = await request({
        hostname: 'localhost', port: 80, path: `/api/waste-batches/${createdBatchId}/qr`, method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      recordResult('HOSPITAL_STAFF', 'Generate QR Code for own batch', 'HOSPITAL_STAFF', '200/201 Success', `${qrRes.status}`, qrRes.status === 200 || qrRes.status === 201);
    }

    // Forbidden: Access User Directory
    const r3 = await request({ hostname: 'localhost', port: 80, path: '/api/users', method: 'GET', headers: { Authorization: `Bearer ${token}` } });
    recordResult('HOSPITAL_STAFF', 'Access User Directory', 'HOSPITAL_STAFF', '403 Forbidden', `${r3.status}`, r3.status === 403);

    // Forbidden: Provision User
    const r4 = await request({
      hostname: 'localhost', port: 80, path: '/api/users', method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    }, { name: 'Staff Child', email: `child.${Date.now()}@biotrack.in`, password: 'Password@123', role: 'HOSPITAL_STAFF' });
    recordResult('HOSPITAL_STAFF', 'Attempt to Provision User', 'HOSPITAL_STAFF', '403 Forbidden', `${r4.status}`, r4.status === 403);

    // Forbidden: Access System Audit Log
    const r5 = await request({ hostname: 'localhost', port: 80, path: '/api/audit-log', method: 'GET', headers: { Authorization: `Bearer ${token}` } });
    recordResult('HOSPITAL_STAFF', 'Access System Audit Log', 'HOSPITAL_STAFF', '403 Forbidden', `${r5.status}`, r5.status === 403);

    // Forbidden: Verify Arrival of Waste (CBWTF role)
    if (createdBatchId) {
      const r6 = await request({
        hostname: 'localhost', port: 80, path: `/api/waste-batches/${createdBatchId}/verify-arrival`, method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      }, { latitude: 19.2183, longitude: 72.9781 });
      recordResult('HOSPITAL_STAFF', 'Attempt to Verify Arrival (CBWTF action)', 'HOSPITAL_STAFF', '403 Forbidden', `${r6.status}`, r6.status === 403);
    }
  }

  // 5. COLLECTION_STAFF RBAC & Boundary Tests
  console.log('\n--- Step 5: Testing COLLECTION_STAFF ---');
  {
    const token = tokens.COLLECTION_STAFF;
    // Allowed: Universal QR Scanner
    const r1 = await request({
      hostname: 'localhost', port: 80, path: '/api/scan', method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    }, { codeValue: 'BMW-2026-000007' });
    recordResult('COLLECTION_STAFF', 'Scan Waste QR Code', 'COLLECTION_STAFF', '200 OK', `${r1.status}`, r1.status === 200);

    // Allowed: View Vehicles
    const r2 = await request({ hostname: 'localhost', port: 80, path: '/api/transport/vehicles', method: 'GET', headers: { Authorization: `Bearer ${token}` } });
    recordResult('COLLECTION_STAFF', 'List Transport Vehicles', 'COLLECTION_STAFF', '200 OK', `${r2.status}`, r2.status === 200);

    // Forbidden: Access Hospital Dashboard
    const r3 = await request({ hostname: 'localhost', port: 80, path: '/api/dashboard/hospital', method: 'GET', headers: { Authorization: `Bearer ${token}` } });
    recordResult('COLLECTION_STAFF', 'Access Hospital Dashboard', 'COLLECTION_STAFF', '403 Forbidden', `${r3.status}`, r3.status === 403);

    // Forbidden: Create Waste Batch
    const r4 = await request({
      hostname: 'localhost', port: 80, path: '/api/waste-batches', method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    }, { categoryId, department: 'ICU', quantity: 5, unit: 'KG' });
    recordResult('COLLECTION_STAFF', 'Create Waste Batch (Hospital action)', 'COLLECTION_STAFF', '403 Forbidden', `${r4.status}`, r4.status === 403);

    // Forbidden: Access Audit Log
    const r5 = await request({ hostname: 'localhost', port: 80, path: '/api/audit-log', method: 'GET', headers: { Authorization: `Bearer ${token}` } });
    recordResult('COLLECTION_STAFF', 'Access System Audit Log', 'COLLECTION_STAFF', '403 Forbidden', `${r5.status}`, r5.status === 403);
  }

  // 6. TRANSPORT_PERSONNEL RBAC & Boundary Tests
  console.log('\n--- Step 6: Testing TRANSPORT_PERSONNEL ---');
  {
    const token = tokens.TRANSPORT_PERSONNEL;
    // Allowed: Active Driver Assignment
    const r1 = await request({ hostname: 'localhost', port: 80, path: '/api/transport/my-assignment', method: 'GET', headers: { Authorization: `Bearer ${token}` } });
    recordResult('TRANSPORT_PERSONNEL', 'Access My Active Assignment', 'TRANSPORT_PERSONNEL', '200 OK', `${r1.status}`, r1.status === 200);

    // Allowed: Universal Scanner
    const r2 = await request({
      hostname: 'localhost', port: 80, path: '/api/scan', method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    }, { codeValue: 'BMW-2026-000007' });
    recordResult('TRANSPORT_PERSONNEL', 'Scan Waste QR Code', 'TRANSPORT_PERSONNEL', '200 OK', `${r2.status}`, r2.status === 200);

    // Forbidden: Create Waste Batch
    const r3 = await request({
      hostname: 'localhost', port: 80, path: '/api/waste-batches', method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    }, { categoryId, department: 'ICU', quantity: 5, unit: 'KG' });
    recordResult('TRANSPORT_PERSONNEL', 'Create Waste Batch', 'TRANSPORT_PERSONNEL', '403 Forbidden', `${r3.status}`, r3.status === 403);

    // Forbidden: Access Government Dashboard
    const r4 = await request({ hostname: 'localhost', port: 80, path: '/api/dashboard/government', method: 'GET', headers: { Authorization: `Bearer ${token}` } });
    recordResult('TRANSPORT_PERSONNEL', 'Access Government Dashboard', 'TRANSPORT_PERSONNEL', '403 Forbidden', `${r4.status}`, r4.status === 403);

    // Forbidden: Access Audit Log
    const r5 = await request({ hostname: 'localhost', port: 80, path: '/api/audit-log', method: 'GET', headers: { Authorization: `Bearer ${token}` } });
    recordResult('TRANSPORT_PERSONNEL', 'Access System Audit Log', 'TRANSPORT_PERSONNEL', '403 Forbidden', `${r5.status}`, r5.status === 403);
  }

  // 7. TREATMENT_FACILITY_STAFF RBAC & Boundary Tests
  console.log('\n--- Step 7: Testing TREATMENT_FACILITY_STAFF ---');
  {
    const token = tokens.TREATMENT_FACILITY_STAFF;
    // Allowed: Treatment Facility Dashboard
    const r1 = await request({ hostname: 'localhost', port: 80, path: '/api/dashboard/facility', method: 'GET', headers: { Authorization: `Bearer ${token}` } });
    recordResult('TREATMENT_FACILITY_STAFF', 'Access CBWTF Dashboard', 'TREATMENT_FACILITY_STAFF', '200 OK', `${r1.status}`, r1.status === 200);

    // Allowed: Scan QR
    const r2 = await request({
      hostname: 'localhost', port: 80, path: '/api/scan', method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    }, { codeValue: 'BMW-2026-000007' });
    recordResult('TREATMENT_FACILITY_STAFF', 'Scan Inbound QR Code', 'TREATMENT_FACILITY_STAFF', '200 OK', `${r2.status}`, r2.status === 200);

    // Forbidden: Access Hospital Dashboard
    const r3 = await request({ hostname: 'localhost', port: 80, path: '/api/dashboard/hospital', method: 'GET', headers: { Authorization: `Bearer ${token}` } });
    recordResult('TREATMENT_FACILITY_STAFF', 'Access Hospital Dashboard', 'TREATMENT_FACILITY_STAFF', '403 Forbidden', `${r3.status}`, r3.status === 403);

    // Forbidden: Create Waste Batch
    const r4 = await request({
      hostname: 'localhost', port: 80, path: '/api/waste-batches', method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    }, { categoryId, department: 'Pathology', quantity: 3, unit: 'KG' });
    recordResult('TREATMENT_FACILITY_STAFF', 'Create Waste Batch (Hospital action)', 'TREATMENT_FACILITY_STAFF', '403 Forbidden', `${r4.status}`, r4.status === 403);

    // Forbidden: Access Audit Log
    const r5 = await request({ hostname: 'localhost', port: 80, path: '/api/audit-log', method: 'GET', headers: { Authorization: `Bearer ${token}` } });
    recordResult('TREATMENT_FACILITY_STAFF', 'Access System Audit Log', 'TREATMENT_FACILITY_STAFF', '403 Forbidden', `${r5.status}`, r5.status === 403);
  }

  // 8. GOVERNMENT_AUTHORITY RBAC & Boundary Tests
  console.log('\n--- Step 8: Testing GOVERNMENT_AUTHORITY ---');
  {
    const token = tokens.GOVERNMENT_AUTHORITY;
    // Allowed: Government Dashboard
    const r1 = await request({ hostname: 'localhost', port: 80, path: '/api/dashboard/government', method: 'GET', headers: { Authorization: `Bearer ${token}` } });
    recordResult('GOVERNMENT_AUTHORITY', 'Access Government Radar Dashboard', 'GOVERNMENT_AUTHORITY', '200 OK', `${r1.status}`, r1.status === 200);

    // Allowed: Facilities Directory
    const r2 = await request({ hostname: 'localhost', port: 80, path: '/api/facilities', method: 'GET', headers: { Authorization: `Bearer ${token}` } });
    recordResult('GOVERNMENT_AUTHORITY', 'View Facilities Directory', 'GOVERNMENT_AUTHORITY', '200 OK', `${r2.status}`, r2.status === 200);

    // Allowed: Compliance Rules
    const r3 = await request({ hostname: 'localhost', port: 80, path: '/api/compliance-rules', method: 'GET', headers: { Authorization: `Bearer ${token}` } });
    recordResult('GOVERNMENT_AUTHORITY', 'View SLA Compliance Rules', 'GOVERNMENT_AUTHORITY', '200 OK', `${r3.status}`, r3.status === 200);

    // Forbidden: Create Waste Batch
    const r4 = await request({
      hostname: 'localhost', port: 80, path: '/api/waste-batches', method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    }, { categoryId, department: 'Test', quantity: 1, unit: 'KG' });
    recordResult('GOVERNMENT_AUTHORITY', 'Create Waste Batch', 'GOVERNMENT_AUTHORITY', '403 Forbidden', `${r4.status}`, r4.status === 403);

    // Forbidden: Provision Users
    const r5 = await request({
      hostname: 'localhost', port: 80, path: '/api/users', method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    }, { name: 'Gov User', email: `gov.${Date.now()}@biotrack.in`, password: 'Password@123', role: 'GOVERNMENT_AUTHORITY' });
    recordResult('GOVERNMENT_AUTHORITY', 'Provision Users (Super Admin action)', 'GOVERNMENT_AUTHORITY', '403 Forbidden', `${r5.status}`, r5.status === 403);

    // Forbidden: Approve/Suspend Facilities
    const r6 = await request({
      hostname: 'localhost', port: 80, path: '/api/facilities/a13ef6cd-ed6c-4f95-8c49-3c5e781e9e74/approve', method: 'PATCH',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    }, { action: 'APPROVED' });
    recordResult('GOVERNMENT_AUTHORITY', 'Approve Facility (Super Admin action)', 'GOVERNMENT_AUTHORITY', '403 Forbidden', `${r6.status}`, r6.status === 403);

    // Forbidden: Access Audit Log
    const r7 = await request({ hostname: 'localhost', port: 80, path: '/api/audit-log', method: 'GET', headers: { Authorization: `Bearer ${token}` } });
    recordResult('GOVERNMENT_AUTHORITY', 'Access System Audit Log', 'GOVERNMENT_AUTHORITY', '403 Forbidden', `${r7.status}`, r7.status === 403);
  }

  // 9. SUPER_ADMIN RBAC & Broad Access Tests
  console.log('\n--- Step 9: Testing SUPER_ADMIN ---');
  {
    const token = tokens.SUPER_ADMIN;
    // Allowed: All Dashboards
    const r1 = await request({ hostname: 'localhost', port: 80, path: '/api/dashboard/government', method: 'GET', headers: { Authorization: `Bearer ${token}` } });
    recordResult('SUPER_ADMIN', 'Access Government Dashboard', 'SUPER_ADMIN', '200 OK', `${r1.status}`, r1.status === 200);

    // Allowed: Audit Log
    const r2 = await request({ hostname: 'localhost', port: 80, path: '/api/audit-log', method: 'GET', headers: { Authorization: `Bearer ${token}` } });
    recordResult('SUPER_ADMIN', 'Access System Audit Log', 'SUPER_ADMIN', '200 OK', `${r2.status}`, r2.status === 200);

    // Allowed: User Management
    const r3 = await request({ hostname: 'localhost', port: 80, path: '/api/users', method: 'GET', headers: { Authorization: `Bearer ${token}` } });
    recordResult('SUPER_ADMIN', 'Access All Users Directory', 'SUPER_ADMIN', '200 OK', `${r3.status}`, r3.status === 200);

    // Allowed: Facilities Management
    const r4 = await request({ hostname: 'localhost', port: 80, path: '/api/facilities', method: 'GET', headers: { Authorization: `Bearer ${token}` } });
    recordResult('SUPER_ADMIN', 'Access Facilities Directory', 'SUPER_ADMIN', '200 OK', `${r4.status}`, r4.status === 200);
  }

  // 10. Role Tampering & Request-Body Spoofing
  console.log('\n--- Step 10: Testing Role Tampering Protection ---');
  {
    const token = tokens.HOSPITAL_STAFF;
    const r1 = await request({
      hostname: 'localhost', port: 80, path: '/api/users', method: 'GET',
      headers: { Authorization: `Bearer ${token}`, 'X-Role-Override': 'SUPER_ADMIN' },
    });
    recordResult('SECURITY_TAMPERING', 'Role Tampering via Custom Header/Context', 'HOSPITAL_STAFF', '403 Forbidden', `${r1.status}`, r1.status === 403);
  }

  // 11. Facility Isolation & Geofence Boundary
  console.log('\n--- Step 11: Testing Facility Isolation & Geofence Boundary ---');
  {
    // Treatment facility arrives outside geofence
    const token = tokens.TREATMENT_FACILITY_STAFF;
    if (createdBatchId) {
      // Intentionally pass coordinates in Delhi (28.6139, 77.2090) when facility is in Mumbai (19.2183, 72.9781)
      const rGeo = await request({
        hostname: 'localhost', port: 80, path: `/api/waste-batches/${createdBatchId}/verify-arrival`, method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      }, { latitude: 28.6139, longitude: 77.2090 });
      // Expect 403 Forbidden due to boundary limit
      recordResult('FACILITY_ISOLATION', 'Arrival Verification Outside Geofence', 'TREATMENT_FACILITY_STAFF', '403 Forbidden', `${rGeo.status}`, rGeo.status === 403);
    }
  }

  // Summary
  const total = RESULTS.length;
  const passed = RESULTS.filter((r) => r.passed).length;
  const failed = RESULTS.filter((r) => !r.passed).length;

  console.log('\n================================================================');
  console.log(`AUDIT COMPLETE: ${passed}/${total} TESTS PASSED (${failed} FAILED)`);
  console.log('================================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runAudit().catch((err) => {
  console.error(err);
  process.exit(1);
});
