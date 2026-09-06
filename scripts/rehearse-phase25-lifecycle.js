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
  return { token: res.data?.accessToken, user: res.data?.user, status: res.status };
}

async function runRehearsal() {
  console.log('================================================================');
  console.log('PHASE 25 — COMPLETE END-TO-END LIFECYCLE REHEARSAL');
  console.log('================================================================\n');

  // 1. Authenticate All Key Roles
  console.log('--- Step 1: Authenticating Actors ---');
  const staffAuth = await login('staff@citygeneral.in', 'BioTrack@2026');
  const collectionAuth = await login('collection@biotrack.in', 'BioTrack@2026');
  const transportAuth = await login('transport@biotrack.in', 'BioTrack@2026');
  const facilityAuth = await login('facility@greendispose.in', 'BioTrack@2026');
  const adminAuth = await login('admin@biotrack.in', 'BioTrack@2026');

  if (!staffAuth.token || !collectionAuth.token || !transportAuth.token || !facilityAuth.token || !adminAuth.token) {
    throw new Error('Failed to authenticate one or more rehearsal actors');
  }
  console.log('  ✅ Hospital Staff      :', staffAuth.user.email);
  console.log('  ✅ Collection Staff    :', collectionAuth.user.email);
  console.log('  ✅ Transport Driver    :', transportAuth.user.email);
  console.log('  ✅ CBWTF Facility Staff:', facilityAuth.user.email);
  console.log('  ✅ Super Admin         :', adminAuth.user.email);

  // 2. Part 1 — Create Fresh Test Batch
  console.log('\n--- Part 1: Hospital Staff Creates Fresh Biomedical Waste Batch ---');
  const categoryId = '305c46d7-122f-4549-9215-f427dbd91633'; // Infectious / Yellow
  const createBatchRes = await request({
    hostname: 'localhost',
    port: 80,
    path: '/api/waste-batches',
    method: 'POST',
    headers: {
      Authorization: `Bearer ${staffAuth.token}`,
      'Content-Type': 'application/json',
    },
  }, {
    categoryId,
    department: 'Emergency Ward',
    quantity: 5.0,
    unit: 'KG',
    photoUrl: 'https://biotrack.in/uploads/emergency-ward-p25.jpg',
  });

  console.log('  -> Status Code:', createBatchRes.status);
  const batch = createBatchRes.data;
  console.log('  -> Waste ID   :', batch?.wasteId);
  console.log('  -> Batch UUID :', batch?.id);
  console.log('  -> Status     :', batch?.status);
  console.log('  -> Hospital ID:', batch?.hospitalId);
  if (createBatchRes.status !== 201 || !batch?.id) {
    throw new Error(`Batch creation failed: ${JSON.stringify(createBatchRes.data)}`);
  }

  // 3. Part 2 — Generate QR Code
  console.log('\n--- Part 2: Generate Cryptographic QR Sticker ---');
  const qrRes = await request({
    hostname: 'localhost',
    port: 80,
    path: `/api/waste-batches/${batch.id}/qr`,
    method: 'POST',
    headers: { Authorization: `Bearer ${staffAuth.token}` },
  });
  console.log('  -> Status Code:', qrRes.status);
  const qrData = qrRes.data;
  console.log('  -> QR Code Value:', qrData?.qrCode?.codeValue);
  console.log('  -> Data URL Prefix:', qrData?.qrDataUrl?.substring(0, 35) + '...');
  if (qrRes.status !== 200 && qrRes.status !== 201) {
    throw new Error(`QR generation failed: ${JSON.stringify(qrRes.data)}`);
  }

  // 4. Part 3 — Collection Staff Scans and Accepts Custody
  console.log('\n--- Part 3: Collection Staff Scans QR & Accepts Custody ---');
  const scanRes = await request({
    hostname: 'localhost',
    port: 80,
    path: '/api/scan',
    method: 'POST',
    headers: {
      Authorization: `Bearer ${collectionAuth.token}`,
      'Content-Type': 'application/json',
    },
  }, { codeValue: qrData.qrCode.codeValue });
  console.log('  -> Scan Response Valid Actions:', scanRes.data?.validActions);

  const collectRes = await request({
    hostname: 'localhost',
    port: 80,
    path: `/api/waste-batches/${batch.id}/custody-events`,
    method: 'POST',
    headers: {
      Authorization: `Bearer ${collectionAuth.token}`,
      'Content-Type': 'application/json',
    },
  }, {
    eventType: 'COLLECTION_ACCEPTED',
    latitude: 19.076,
    longitude: 72.8777,
    notes: 'Verified barcode tag intact at Emergency Ward dock.',
  });
  console.log('  -> Collection Status Code:', collectRes.status);
  console.log('  -> Batch Status after Collection:', collectRes.data?.status);
  if (collectRes.status !== 201) {
    throw new Error(`Collection custody handover failed: ${JSON.stringify(collectRes.data)}`);
  }

  // 5. Part 4 — Dispatcher Creates Transport Assignment
  console.log('\n--- Part 4: Dispatcher Assigns Vehicle & Driver ---');
  const vehicleId = '93be7d95-b33c-4c6c-8764-1953f363d0b9'; // MH-04-AB-1234
  const driverUserId = transportAuth.user.id;
  const expectedFacilityId = '9a0d6780-ddeb-4154-a7e5-b93502d8d663'; // GreenDispose CBWTF

  const assignRes = await request({
    hostname: 'localhost',
    port: 80,
    path: '/api/transport/assignments',
    method: 'POST',
    headers: {
      Authorization: `Bearer ${collectionAuth.token}`,
      'Content-Type': 'application/json',
    },
  }, {
    wasteBatchId: batch.id,
    vehicleId,
    driverUserId,
    expectedFacilityId,
  });
  console.log('  -> Assignment Status Code:', assignRes.status);
  const assignment = assignRes.data;
  console.log('  -> Assignment ID:', assignment?.id);
  console.log('  -> Status:', assignment?.status);
  if (assignRes.status !== 201) {
    throw new Error(`Transport assignment failed: ${JSON.stringify(assignRes.data)}`);
  }

  // 6. Part 5 — Transport Driver Views Active Assignment
  console.log('\n--- Part 5: Transport Driver Inspects In-Cabin HUD ---');
  const myAssignRes = await request({
    hostname: 'localhost',
    port: 80,
    path: '/api/transport/my-assignment',
    method: 'GET',
    headers: { Authorization: `Bearer ${transportAuth.token}` },
  });
  console.log('  -> Driver Active Assignment ID:', myAssignRes.data?.id);
  console.log('  -> Assigned Vehicle Reg Number:', myAssignRes.data?.vehicle?.registrationNumber);
  console.log('  -> Destination Facility:', myAssignRes.data?.expectedFacility?.name);

  // 7. Part 6 — Transport Driver Starts Transport Run
  console.log('\n--- Part 6: Transport Driver Starts Transport Run ---');
  const startTransportRes = await request({
    hostname: 'localhost',
    port: 80,
    path: `/api/waste-batches/${batch.id}/custody-events`,
    method: 'POST',
    headers: {
      Authorization: `Bearer ${transportAuth.token}`,
      'Content-Type': 'application/json',
    },
  }, {
    eventType: 'TRANSPORT_STARTED',
    latitude: 19.07609,
    longitude: 72.877426,
    notes: 'Departing City General Hospital for GreenDispose CBWTF.',
  });
  console.log('  -> Start Transport Status Code:', startTransportRes.status);
  console.log('  -> Batch Status after Start Transport:', startTransportRes.data?.status);
  if (startTransportRes.status !== 201) {
    throw new Error(`Start transport failed: ${JSON.stringify(startTransportRes.data)}`);
  }

  // 8. Part 7 — GPS Telemetry Ingestion
  console.log('\n--- Part 7: Real In-Transit GPS Telemetry Ping ---');
  const gpsRes = await request({
    hostname: 'localhost',
    port: 80,
    path: '/api/gps-pings',
    method: 'POST',
    headers: {
      Authorization: `Bearer ${transportAuth.token}`,
      'Content-Type': 'application/json',
    },
  }, {
    transportAssignmentId: assignment.id,
    latitude: 19.145000,
    longitude: 72.925000,
    speed: 42.0,
    heading: 45.0,
    accuracy: 8.5,
    recordedAt: new Date().toISOString(),
  });
  console.log('  -> GPS Ping Status Code:', gpsRes.status);
  console.log('  -> GPS Ping ID:', gpsRes.data?.id);
  console.log('  -> Telemetry Recorded:', gpsRes.data?.latitude, gpsRes.data?.longitude);
  if (gpsRes.status !== 201) {
    throw new Error(`GPS ping ingestion failed: ${JSON.stringify(gpsRes.data)}`);
  }

  // 9. Part 8 — CBWTF Inbound Verification (Geofence Negative + Positive)
  console.log('\n--- Part 8: CBWTF Staff Inbound Verification (Geofence Check) ---');
  // 9a. Negative: Out-of-geofence attempt (e.g. at Delhi coordinates)
  const negGeoRes = await request({
    hostname: 'localhost',
    port: 80,
    path: `/api/waste-batches/${batch.id}/verify-arrival`,
    method: 'POST',
    headers: {
      Authorization: `Bearer ${facilityAuth.token}`,
      'Content-Type': 'application/json',
    },
  }, {
    latitude: 28.6139,
    longitude: 77.2090,
  });
  console.log('  -> Out-of-Geofence Attempt Status:', negGeoRes.status, `(Expected: 403 Forbidden - ${negGeoRes.data?.message})`);

  // 9b. Positive: Legitimate arrival within GreenDispose CBWTF geofence (19.2183, 72.9781)
  const verifyArrivalRes = await request({
    hostname: 'localhost',
    port: 80,
    path: `/api/waste-batches/${batch.id}/verify-arrival`,
    method: 'POST',
    headers: {
      Authorization: `Bearer ${facilityAuth.token}`,
      'Content-Type': 'application/json',
    },
  }, {
    latitude: 19.2183,
    longitude: 72.9781,
  });
  console.log('  -> In-Geofence Verify Arrival Status:', verifyArrivalRes.status);
  console.log('  -> Batch Status after Arrival Verification:', verifyArrivalRes.data?.status);
  if (verifyArrivalRes.status !== 201) {
    throw new Error(`Verify arrival failed: ${JSON.stringify(verifyArrivalRes.data)}`);
  }

  // 10. Part 9 — Treatment & Verification Closure
  console.log('\n--- Part 9: CBWTF Confirms Treatment & Completes Verification Closure ---');
  const confirmTreatmentRes = await request({
    hostname: 'localhost',
    port: 80,
    path: `/api/waste-batches/${batch.id}/confirm-treatment`,
    method: 'POST',
    headers: {
      Authorization: `Bearer ${facilityAuth.token}`,
      'Content-Type': 'application/json',
    },
  }, {
    photoUrl: 'https://biotrack.in/disposal/incineration-proof-p25-final.jpg',
    latitude: 19.2183,
    longitude: 72.9781,
  });
  console.log('  -> Confirm Treatment Status Code:', confirmTreatmentRes.status);
  console.log('  -> Final Batch Status:', confirmTreatmentRes.data?.status);
  if (confirmTreatmentRes.status !== 201) {
    throw new Error(`Confirm treatment failed: ${JSON.stringify(confirmTreatmentRes.data)}`);
  }

  console.log('\n================================================================');
  console.log('LIFECYCLE REHEARSAL SUCCESSFUL: BATCH VERIFIED_CLOSED');
  console.log(`Waste ID: ${batch.wasteId} | UUID: ${batch.id}`);
  console.log('================================================================');
}

runRehearsal().catch((err) => {
  console.error(err);
  process.exit(1);
});
