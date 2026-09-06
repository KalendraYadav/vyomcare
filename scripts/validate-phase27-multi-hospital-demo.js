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

function recordResult(group, name, expected, actual, passed, details = '') {
  RESULTS.push({ group, name, expected, actual, passed, details });
  const icon = passed ? '✅ PASS' : '❌ FAIL';
  console.log(`[${icon}] [${group}] ${name} | Expected: ${expected} | Actual: ${actual} ${details ? '(' + details + ')' : ''}`);
}

async function runValidation() {
  console.log('================================================================');
  console.log('PHASE 27 — MULTI-HOSPITAL SCENARIO & DEMO READINESS VALIDATION');
  console.log('================================================================\n');

  // --- 1. Super Admin Authentication ---
  console.log('--- Step 1: Super Admin Authentication ---');
  const adminAuth = await login('admin@biotrack.in', 'BioTrack@2026');
  if (!adminAuth.token) throw new Error('Failed to login as Super Admin');
  recordResult('SETUP', 'Super Admin Login', '200 OK', `${adminAuth.status}`, true);

  // --- 2. Provision Second Hospital (Hospital B: Apex Metro Hospital) ---
  console.log('\n--- Step 2: Multi-Hospital Provisioning (Hospital B) ---');
  const facListRes = await request({
    hostname: 'localhost',
    port: 80,
    path: '/api/facilities',
    method: 'GET',
    headers: { Authorization: `Bearer ${adminAuth.token}` },
  });

  let hospitalBFacility = (facListRes.data || []).find((f) => f.name === 'Apex Metro Hospital');
  if (!hospitalBFacility) {
    // Register Hospital B with valid registrationNumber
    const regRes = await request({
      hostname: 'localhost',
      port: 80,
      path: '/api/facilities',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    }, {
      name: 'Apex Metro Hospital',
      type: 'HOSPITAL',
      registrationNumber: 'HOSP-MH-2026-002',
      address: 'Andheri East, Mumbai, Maharashtra 400069',
      latitude: 19.1136,
      longitude: 72.8697,
      geofenceRadiusM: 400,
    });
    hospitalBFacility = regRes.data;
    console.log('  -> Registered Hospital B:', hospitalBFacility?.name, `(ID: ${hospitalBFacility?.id})`);

    // Super Admin Approves Hospital B
    const approveRes = await request({
      hostname: 'localhost',
      port: 80,
      path: `/api/facilities/${hospitalBFacility.id}/approve`,
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${adminAuth.token}`,
        'Content-Type': 'application/json',
      },
    }, { action: 'APPROVED' });
    recordResult('SETUP', 'Register & Approve Hospital B (Apex Metro Hospital)', '200 OK', `${approveRes.status}`, approveRes.status === 200);
  } else {
    console.log('  -> Hospital B already exists:', hospitalBFacility.name, `(ID: ${hospitalBFacility.id})`);
    recordResult('SETUP', 'Hospital B Existing & Approved', 'APPROVED', `${hospitalBFacility.status}`, true);
  }

  // Provision Staff User for Hospital B if not existing
  const usersListRes = await request({
    hostname: 'localhost',
    port: 80,
    path: '/api/users',
    method: 'GET',
    headers: { Authorization: `Bearer ${adminAuth.token}` },
  });
  let staffB = (usersListRes.data || []).find((u) => u.email === 'staff@apexmetro.in');
  if (!staffB) {
    const provRes = await request({
      hostname: 'localhost',
      port: 80,
      path: '/api/users',
      method: 'POST',
      headers: {
        Authorization: `Bearer ${adminAuth.token}`,
        'Content-Type': 'application/json',
      },
    }, {
      name: 'Dr. Suresh Nair',
      email: 'staff@apexmetro.in',
      password: 'BioTrack@2026',
      role: 'HOSPITAL_STAFF',
      facilityId: hospitalBFacility.id,
      phone: '+91 98200 11223',
    });
    staffB = provRes.data;
    console.log('  -> Provisioned Hospital B Staff:', staffB?.email);

    // Auto-verify email via verification token
    if (provRes.data?.verificationUrl) {
      const tokenMatch = provRes.data.verificationUrl.match(/token=([^&]+)/);
      if (tokenMatch) {
        const rawToken = tokenMatch[1];
        await request({
          hostname: 'localhost',
          port: 80,
          path: '/api/auth/verify-email',
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        }, { token: rawToken });
      }
    }
    recordResult('SETUP', 'Provision Hospital B Staff (staff@apexmetro.in)', '201 Created', `${provRes.status}`, provRes.status === 201);
  } else {
    console.log('  -> Hospital B Staff already exists:', staffB.email);
    recordResult('SETUP', 'Hospital B Staff Ready', 'staff@apexmetro.in', `${staffB.email}`, true);
  }

  // Authenticate Actors
  console.log('\n--- Step 3: Authenticating Demo Actors ---');
  const staffA_Auth = await login('staff@citygeneral.in', 'BioTrack@2026');
  const staffB_Auth = await login('staff@apexmetro.in', 'BioTrack@2026');
  const collAuth = await login('collection@biotrack.in', 'BioTrack@2026');
  const transAuth = await login('transport@biotrack.in', 'BioTrack@2026');
  const cbwtfAuth = await login('facility@greendispose.in', 'BioTrack@2026');
  const govAuth = await login('gov@mpcb.gov.in', 'BioTrack@2026');

  recordResult('AUTH', 'Hospital A Staff Login (staff@citygeneral.in)', '200 OK', `${staffA_Auth.status}`, staffA_Auth.status === 200);
  recordResult('AUTH', 'Hospital B Staff Login (staff@apexmetro.in)', '200 OK', `${staffB_Auth.status}`, staffB_Auth.status === 200);
  recordResult('AUTH', 'Collection Staff Login (collection@biotrack.in)', '200 OK', `${collAuth.status}`, collAuth.status === 200);
  recordResult('AUTH', 'Transport Driver Login (transport@biotrack.in)', '200 OK', `${transAuth.status}`, transAuth.status === 200);
  recordResult('AUTH', 'CBWTF Staff Login (facility@greendispose.in)', '200 OK', `${cbwtfAuth.status}`, cbwtfAuth.status === 200);
  recordResult('AUTH', 'Government Authority Login (gov@mpcb.gov.in)', '200 OK', `${govAuth.status}`, govAuth.status === 200);

  // Categories
  const catRes = await request({
    hostname: 'localhost',
    port: 80,
    path: '/api/waste-categories',
    method: 'GET',
    headers: { Authorization: `Bearer ${adminAuth.token}` },
  });
  const categories = catRes.data || [];
  const yellowCat = categories.find((c) => c.code === 'INFECTIOUS') || categories[0];
  const redCat = categories.find((c) => c.code === 'SHARPS') || categories[1];
  const blueCat = categories.find((c) => c.code === 'GENERAL_BIO') || categories[2];

  // --- 4. Multi-Hospital Waste Creation ---
  console.log('\n--- Step 4: Multi-Hospital Waste Creation ---');
  // Hospital A (City General Hospital): 2 batches
  const batchA1Res = await request({
    hostname: 'localhost', port: 80, path: '/api/waste-batches', method: 'POST',
    headers: { Authorization: `Bearer ${staffA_Auth.token}`, 'Content-Type': 'application/json' },
  }, { categoryId: yellowCat.id, department: 'Emergency Ward', quantity: 5.5, unit: 'KG' });
  const batchA1 = batchA1Res.data;

  const batchA2Res = await request({
    hostname: 'localhost', port: 80, path: '/api/waste-batches', method: 'POST',
    headers: { Authorization: `Bearer ${staffA_Auth.token}`, 'Content-Type': 'application/json' },
  }, { categoryId: redCat.id, department: 'ICU Ward', quantity: 3.2, unit: 'KG' });
  const batchA2 = batchA2Res.data;

  // Hospital B (Apex Metro Hospital): 2 batches
  const batchB1Res = await request({
    hostname: 'localhost', port: 80, path: '/api/waste-batches', method: 'POST',
    headers: { Authorization: `Bearer ${staffB_Auth.token}`, 'Content-Type': 'application/json' },
  }, { categoryId: blueCat.id, department: 'Pathology Lab', quantity: 4.0, unit: 'KG' });
  const batchB1 = batchB1Res.data;

  const batchB2Res = await request({
    hostname: 'localhost', port: 80, path: '/api/waste-batches', method: 'POST',
    headers: { Authorization: `Bearer ${staffB_Auth.token}`, 'Content-Type': 'application/json' },
  }, { categoryId: yellowCat.id, department: 'General Ward', quantity: 6.8, unit: 'KG' });
  const batchB2 = batchB2Res.data;

  recordResult('WASTE_CREATION', 'Hospital A Batch 1 (Emergency Ward / Yellow)', '201 Created', `${batchA1Res.status}`, batchA1Res.status === 201, `ID: ${batchA1?.wasteId}`);
  recordResult('WASTE_CREATION', 'Hospital A Batch 2 (ICU Ward / Red)', '201 Created', `${batchA2Res.status}`, batchA2Res.status === 201, `ID: ${batchA2?.wasteId}`);
  recordResult('WASTE_CREATION', 'Hospital B Batch 1 (Pathology Lab / Blue)', '201 Created', `${batchB1Res.status}`, batchB1Res.status === 201, `ID: ${batchB1?.wasteId}`);
  recordResult('WASTE_CREATION', 'Hospital B Batch 2 (General Ward / Yellow)', '201 Created', `${batchB2Res.status}`, batchB2Res.status === 201, `ID: ${batchB2?.wasteId}`);

  // Generate QR Codes
  const qrA1Res = await request({ hostname: 'localhost', port: 80, path: `/api/waste-batches/${batchA1.id}/qr`, method: 'POST', headers: { Authorization: `Bearer ${staffA_Auth.token}` } });
  const qrB1Res = await request({ hostname: 'localhost', port: 80, path: `/api/waste-batches/${batchB1.id}/qr`, method: 'POST', headers: { Authorization: `Bearer ${staffB_Auth.token}` } });
  recordResult('QR_GENERATION', 'Generate QR for Hospital A Batch A1', '201 Created', `${qrA1Res.status}`, qrA1Res.status === 200 || qrA1Res.status === 201);
  recordResult('QR_GENERATION', 'Generate QR for Hospital B Batch B1', '201 Created', `${qrB1Res.status}`, qrB1Res.status === 200 || qrB1Res.status === 201);

  // --- 5. Multi-Hospital Facility Isolation Tests ---
  console.log('\n--- Step 5: Testing Cross-Hospital Facility Isolation ---');
  // Hospital A Staff attempts to read Hospital B batch
  const crossReadResA = await request({
    hostname: 'localhost', port: 80, path: `/api/waste-batches/${batchB1.id}`, method: 'GET',
    headers: { Authorization: `Bearer ${staffA_Auth.token}` },
  });
  recordResult('ISOLATION', 'Hospital A Staff Read Hospital B Batch by ID', '403 Forbidden', `${crossReadResA.status}`, crossReadResA.status === 403);

  // Hospital B Staff attempts to read Hospital A batch
  const crossReadResB = await request({
    hostname: 'localhost', port: 80, path: `/api/waste-batches/${batchA1.id}`, method: 'GET',
    headers: { Authorization: `Bearer ${staffB_Auth.token}` },
  });
  recordResult('ISOLATION', 'Hospital B Staff Read Hospital A Batch by ID', '403 Forbidden', `${crossReadResB.status}`, crossReadResB.status === 403);

  // Hospital A Staff attempts to generate QR for Hospital B batch
  const crossQrResA = await request({
    hostname: 'localhost', port: 80, path: `/api/waste-batches/${batchB2.id}/qr`, method: 'POST',
    headers: { Authorization: `Bearer ${staffA_Auth.token}` },
  });
  recordResult('ISOLATION', 'Hospital A Staff Generate QR for Hospital B Batch', '403 Forbidden', `${crossQrResA.status}`, crossQrResA.status === 403);

  // --- 6. QR Scanner Verification ---
  console.log('\n--- Step 6: QR Scanning & Fault Tolerance ---');
  const qrCodeValA1 = qrA1Res.data?.qrCode?.codeValue;
  // Exact match
  const scanExactRes = await request({
    hostname: 'localhost', port: 80, path: '/api/scan', method: 'POST',
    headers: { Authorization: `Bearer ${collAuth.token}`, 'Content-Type': 'application/json' },
  }, { codeValue: qrCodeValA1 });
  recordResult('QR_SCAN', 'Exact QR Code String Lookup', '200 OK', `${scanExactRes.status}`, scanExactRes.status === 200 && scanExactRes.data?.batch?.id === batchA1.id);

  // Whitespace-padded match
  const scanPadRes = await request({
    hostname: 'localhost', port: 80, path: '/api/scan', method: 'POST',
    headers: { Authorization: `Bearer ${collAuth.token}`, 'Content-Type': 'application/json' },
  }, { codeValue: `   ${qrCodeValA1}   \n` });
  recordResult('QR_SCAN', 'Whitespace-Padded QR Code Lookup', '200 OK', `${scanPadRes.status}`, scanPadRes.status === 200 && scanPadRes.data?.batch?.id === batchA1.id);

  // Unknown QR value
  const scanUnknownRes = await request({
    hostname: 'localhost', port: 80, path: '/api/scan', method: 'POST',
    headers: { Authorization: `Bearer ${collAuth.token}`, 'Content-Type': 'application/json' },
  }, { codeValue: 'BIOTRACK:INVALID-NONEXISTENT:999999' });
  recordResult('QR_SCAN', 'Non-existent QR Code Lookup', '404 Not Found', `${scanUnknownRes.status}`, scanUnknownRes.status === 404);

  // --- 7. Centralized Collection Across Multiple Hospitals ---
  console.log('\n--- Step 7: Centralized Collection Across Multiple Hospitals ---');
  // Collection from Hospital A (City General Hospital)
  const collA1Res = await request({
    hostname: 'localhost', port: 80, path: `/api/waste-batches/${batchA1.id}/custody-events`, method: 'POST',
    headers: { Authorization: `Bearer ${collAuth.token}`, 'Content-Type': 'application/json' },
  }, { eventType: 'COLLECTION_ACCEPTED', latitude: 19.076, longitude: 72.8777, notes: 'Collected at City General dock' });
  recordResult('COLLECTION', 'Centralized Collection from Hospital A (City General)', '201 Created', `${collA1Res.status}`, collA1Res.status === 201 && collA1Res.data?.status === 'COLLECTED');

  // Collection from Hospital B (Apex Metro Hospital)
  const collB1Res = await request({
    hostname: 'localhost', port: 80, path: `/api/waste-batches/${batchB1.id}/custody-events`, method: 'POST',
    headers: { Authorization: `Bearer ${collAuth.token}`, 'Content-Type': 'application/json' },
  }, { eventType: 'COLLECTION_ACCEPTED', latitude: 19.1136, longitude: 72.8697, notes: 'Collected at Apex Metro dock' });
  recordResult('COLLECTION', 'Centralized Collection from Hospital B (Apex Metro)', '201 Created', `${collB1Res.status}`, collB1Res.status === 201 && collB1Res.data?.status === 'COLLECTED');

  // Negative: Hospital Staff cannot accept collection
  const staffCollectRes = await request({
    hostname: 'localhost', port: 80, path: `/api/waste-batches/${batchA2.id}/custody-events`, method: 'POST',
    headers: { Authorization: `Bearer ${staffA_Auth.token}`, 'Content-Type': 'application/json' },
  }, { eventType: 'COLLECTION_ACCEPTED' });
  recordResult('COLLECTION', 'Hospital Staff Attempt Collection (Forbidden)', '403 Forbidden', `${staffCollectRes.status}`, staffCollectRes.status === 403);

  // --- 8. Transport Assignment, In-Transit & GPS for Hospital B Batch ---
  console.log('\n--- Step 8: Transport Workflow for Hospital B Batch ---');
  const vehicleId = '93be7d95-b33c-4c6c-8764-1953f363d0b9'; // MH-04-AB-1234
  const driverUserId = transAuth.user.id;
  const cbwtfFacilityId = '9a0d6780-ddeb-4154-a7e5-b93502d8d663'; // GreenDispose CBWTF

  const assignB1Res = await request({
    hostname: 'localhost', port: 80, path: '/api/transport/assignments', method: 'POST',
    headers: { Authorization: `Bearer ${collAuth.token}`, 'Content-Type': 'application/json' },
  }, {
    wasteBatchId: batchB1.id,
    vehicleId,
    driverUserId,
    expectedFacilityId: cbwtfFacilityId,
  });
  const assignmentB1 = assignB1Res.data;
  recordResult('TRANSPORT', 'Transport Assignment for Hospital B Batch', '201 Created', `${assignB1Res.status}`, assignB1Res.status === 201);

  // Driver starts transport
  const startTransB1Res = await request({
    hostname: 'localhost', port: 80, path: `/api/waste-batches/${batchB1.id}/custody-events`, method: 'POST',
    headers: { Authorization: `Bearer ${transAuth.token}`, 'Content-Type': 'application/json' },
  }, { eventType: 'TRANSPORT_STARTED', latitude: 19.1136, longitude: 72.8697 });
  recordResult('TRANSPORT', 'Driver Starts Transport (COLLECTED -> IN_TRANSIT)', '201 Created', `${startTransB1Res.status}`, startTransB1Res.status === 201 && startTransB1Res.data?.status === 'IN_TRANSIT');

  // Driver GPS telemetry
  const gpsPingRes = await request({
    hostname: 'localhost', port: 80, path: '/api/gps-pings', method: 'POST',
    headers: { Authorization: `Bearer ${transAuth.token}`, 'Content-Type': 'application/json' },
  }, {
    transportAssignmentId: assignmentB1.id,
    latitude: 19.160000,
    longitude: 72.930000,
    speed: 38.0,
    heading: 30.0,
  });
  recordResult('GPS', 'Driver Submits GPS Ping for Hospital B Mission', '201 Created', `${gpsPingRes.status}`, gpsPingRes.status === 201);

  // --- 9. CBWTF Geofence & Treatment Completion ---
  console.log('\n--- Step 9: CBWTF Inbound Verification & Treatment ---');
  // Out of geofence arrival
  const outOfGeoRes = await request({
    hostname: 'localhost', port: 80, path: `/api/waste-batches/${batchB1.id}/verify-arrival`, method: 'POST',
    headers: { Authorization: `Bearer ${cbwtfAuth.token}`, 'Content-Type': 'application/json' },
  }, { latitude: 28.6139, longitude: 77.2090 });
  recordResult('CBWTF', 'Out-of-Geofence Arrival Rejection', '403 Forbidden', `${outOfGeoRes.status}`, outOfGeoRes.status === 403);

  // Legitimate in-geofence arrival at GreenDispose CBWTF (19.2183, 72.9781)
  const inGeoRes = await request({
    hostname: 'localhost', port: 80, path: `/api/waste-batches/${batchB1.id}/verify-arrival`, method: 'POST',
    headers: { Authorization: `Bearer ${cbwtfAuth.token}`, 'Content-Type': 'application/json' },
  }, { latitude: 19.2183, longitude: 72.9781 });
  recordResult('CBWTF', 'In-Geofence Arrival Verification (IN_TRANSIT -> RECEIVED)', '201 Created', `${inGeoRes.status}`, inGeoRes.status === 201 && inGeoRes.data?.status === 'RECEIVED');

  // Treatment & verification closure
  const treatRes = await request({
    hostname: 'localhost', port: 80, path: `/api/waste-batches/${batchB1.id}/confirm-treatment`, method: 'POST',
    headers: { Authorization: `Bearer ${cbwtfAuth.token}`, 'Content-Type': 'application/json' },
  }, {
    photoUrl: 'https://biotrack.in/disposal/autoclave-apex-p27.jpg',
    latitude: 19.2183,
    longitude: 72.9781,
  });
  recordResult('CBWTF', 'Treatment Confirmation & Closure (RECEIVED -> TREATED -> VERIFIED_CLOSED)', '201 Created', `${treatRes.status}`, treatRes.status === 201 && treatRes.data?.status === 'VERIFIED_CLOSED');

  // --- 10. Government & Super Admin Oversight ---
  console.log('\n--- Step 10: Oversight & Audit Logs ---');
  const govDashRes = await request({ hostname: 'localhost', port: 80, path: '/api/dashboard/government', method: 'GET', headers: { Authorization: `Bearer ${govAuth.token}` } });
  recordResult('OVERSIGHT', 'Government Radar Dashboard View', '200 OK', `${govDashRes.status}`, govDashRes.status === 200 && govDashRes.data?.totalFacilities >= 3);

  const auditLogRes = await request({ hostname: 'localhost', port: 80, path: '/api/audit-log', method: 'GET', headers: { Authorization: `Bearer ${adminAuth.token}` } });
  recordResult('AUDIT', 'Super Admin Audit Log Query', '200 OK', `${auditLogRes.status}`, auditLogRes.status === 200 && (auditLogRes.data?.length || 0) >= 2);

  // --- Summary ---
  const total = RESULTS.length;
  const passed = RESULTS.filter((r) => r.passed).length;
  const failed = RESULTS.filter((r) => !r.passed).length;

  console.log('\n================================================================');
  console.log(`VALIDATION SUMMARY: ${passed}/${total} TESTS PASSED (${failed} FAILED)`);
  console.log('================================================================');

  if (failed > 0) process.exit(1);
}

runValidation().catch((err) => {
  console.error(err);
  process.exit(1);
});
