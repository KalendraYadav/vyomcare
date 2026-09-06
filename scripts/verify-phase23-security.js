const http = require('http');

async function request(options, data = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, headers: res.headers, data: body ? JSON.parse(body) : null, raw: body });
        } catch (e) {
          resolve({ status: res.statusCode, headers: res.headers, data: body, raw: body });
        }
      });
    });
    req.on('error', reject);
    if (data) req.write(typeof data === 'string' ? data : JSON.stringify(data));
    req.end();
  });
}

async function login(email, password) {
  const res = await request({
    hostname: 'localhost',
    port: 80,
    path: '/api/auth/login',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  }, { email, password });
  return res.data?.accessToken;
}

async function run() {
  console.log('==================================================');
  console.log('PHASE 23 — GPS SECURITY TEST SUITE (INTEGRATION)');
  console.log('==================================================\n');

  // 1. Driver A Login
  console.log('[Step 1] Logging in as Driver A (transport@biotrack.in)...');
  const driverToken = await login('transport@biotrack.in', 'BioTrack@2026');
  if (!driverToken) throw new Error('Failed to login as Driver A');
  console.log('  -> Success, Driver A token acquired.');

  // Fetch Driver A's assignment
  const myAssignRes = await request({
    hostname: 'localhost',
    port: 80,
    path: '/api/transport/my-assignment',
    method: 'GET',
    headers: { 'Authorization': `Bearer ${driverToken}` }
  });
  const myAssignment = myAssignRes.data;
  console.log(`  -> Active Assignment ID: ${myAssignment?.id}`);
  console.log(`  -> Waste Batch ID: ${myAssignment?.wasteBatchId}`);
  console.log(`  -> Vehicle: ${myAssignment?.vehicle?.registrationNumber} (ID: ${myAssignment?.vehicleId})`);
  console.log(`  -> Driver User ID: ${myAssignment?.driverUserId}`);
  console.log(`  -> Status: ${myAssignment?.status}`);

  if (!myAssignment || !myAssignment.id) throw new Error('No active assignment found for Driver A');

  // 2. Test A: Driver A posts GPS to own assignment
  console.log('\n[Test A] Driver A (Authoritative JWT: Driver A) -> Own Assignment -> GPS Ping...');
  const testARes = await request({
    hostname: 'localhost',
    port: 80,
    path: '/api/gps-pings',
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${driverToken}`,
      'Content-Type': 'application/json'
    }
  }, {
    transportAssignmentId: myAssignment.id,
    latitude: 19.076090,
    longitude: 72.877426,
    speed: 38.5,
    heading: 180.0,
    recordedAt: new Date().toISOString()
  });
  console.log(`  -> Response Status: ${testARes.status}`);
  console.log(`  -> Response Data:`, JSON.stringify(testARes.data));
  const testAPassed = testARes.status === 201;
  console.log(`  -> Result: ${testAPassed ? '✅ PASS (201 Created)' : '❌ FAIL'}`);

  // 3. User B (Hospital Staff / Other user) Login
  console.log('\n[Step 2] Logging in as User B (staff@citygeneral.in - HOSPITAL_STAFF)...');
  const userBToken = await login('staff@citygeneral.in', 'BioTrack@2026');
  if (!userBToken) throw new Error('Failed to login as User B');
  console.log('  -> Success, User B token acquired.');

  // 4. Test B: User B -> Driver A's assignment -> GPS Ping
  console.log('\n[Test B] User B (Authoritative JWT: User B) -> Driver A\'s Assignment -> GPS Ping...');
  const testBRes = await request({
    hostname: 'localhost',
    port: 80,
    path: '/api/gps-pings',
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${userBToken}`,
      'Content-Type': 'application/json'
    }
  }, {
    transportAssignmentId: myAssignment.id,
    latitude: 19.080000,
    longitude: 72.880000
  });
  console.log(`  -> Response Status: ${testBRes.status}`);
  console.log(`  -> Response Data:`, JSON.stringify(testBRes.data));
  const testBPassed = testBRes.status === 403;
  console.log(`  -> Result: ${testBPassed ? '✅ PASS (403 Forbidden)' : '❌ FAIL'}`);

  // 5. Test C: Unauthenticated -> GPS Ping
  console.log('\n[Test C] Unauthenticated Request -> GPS Ping...');
  const testCRes = await request({
    hostname: 'localhost',
    port: 80,
    path: '/api/gps-pings',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    }
  }, {
    transportAssignmentId: myAssignment.id,
    latitude: 19.076090,
    longitude: 72.877426
  });
  console.log(`  -> Response Status: ${testCRes.status}`);
  console.log(`  -> Response Data:`, JSON.stringify(testCRes.data));
  const testCPassed = testCRes.status === 401;
  console.log(`  -> Result: ${testCPassed ? '✅ PASS (401 Unauthorized)' : '❌ FAIL'}`);

  // 6. Test D: Super Admin -> Administrative GPS Ping
  console.log('\n[Test D] Super Admin (Role: SUPER_ADMIN) -> Legitimate Admin GPS Operation...');
  const adminToken = await login('admin@biotrack.in', 'BioTrack@2026');
  const testDRes = await request({
    hostname: 'localhost',
    port: 80,
    path: '/api/gps-pings',
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${adminToken}`,
      'Content-Type': 'application/json'
    }
  }, {
    transportAssignmentId: myAssignment.id,
    latitude: 19.077000,
    longitude: 72.878000
  });
  console.log(`  -> Response Status: ${testDRes.status}`);
  console.log(`  -> Response Data:`, JSON.stringify(testDRes.data));
  const testDPassed = testDRes.status === 201;
  console.log(`  -> Result: ${testDPassed ? '✅ PASS (201 Created)' : '❌ FAIL'}`);

  // 7. Test E: Non-existent Assignment ID
  console.log('\n[Test E] Driver A -> Non-existent Assignment ID -> GPS Ping...');
  const testERes = await request({
    hostname: 'localhost',
    port: 80,
    path: '/api/gps-pings',
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${driverToken}`,
      'Content-Type': 'application/json'
    }
  }, {
    transportAssignmentId: '00000000-0000-4000-8000-000000000000',
    latitude: 19.076090,
    longitude: 72.877426
  });
  console.log(`  -> Response Status: ${testERes.status}`);
  console.log(`  -> Response Data:`, JSON.stringify(testERes.data));
  const testEPassed = testERes.status === 404;
  console.log(`  -> Result: ${testEPassed ? '✅ PASS (404 Not Found)' : '❌ FAIL'}`);

  console.log('\n==================================================');
  console.log('SECURITY MATRIX RESULTS');
  console.log('==================================================');
  console.log(`Test A (Driver A own assignment)           : ${testAPassed ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`Test B (Unauthorized cross-user attempt)  : ${testBPassed ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`Test C (Unauthenticated request)          : ${testCPassed ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`Test D (Super Admin administrative ping)   : ${testDPassed ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`Test E (Non-existent assignment)           : ${testEPassed ? '✅ PASS' : '❌ FAIL'}`);

  if (!testAPassed || !testBPassed || !testCPassed || !testDPassed || !testEPassed) {
    process.exit(1);
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
