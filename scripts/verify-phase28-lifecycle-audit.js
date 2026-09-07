/**
 * Phase 28 — Real User Account Lifecycle & Administrative Provisioning Audit Script
 * Validates real-user provisioning, password security, email verification, RBAC rules,
 * deactivation, audit logs, and cross-origin HTTPS tunnel connectivity.
 */

const https = require('https');
const http = require('http');
const { execSync } = require('child_process');

const LOCAL_URL = 'http://localhost';
const TUNNEL_URL = 'https://outreach-desert-rankings-innovative.trycloudflare.com';

let passedTests = 0;
let totalTests = 0;

function logPass(testName, details) {
  passedTests++;
  totalTests++;
  console.log(`[✅ PASS] ${testName} | ${details}`);
}

function logFail(testName, details) {
  totalTests++;
  console.error(`[❌ FAIL] ${testName} | ${details}`);
}

function request(url, options = {}, data = null) {
  return new Promise((resolve, reject) => {
    const isHttps = url.startsWith('https');
    const lib = isHttps ? https : http;
    const parsedUrl = new URL(url);

    const reqOptions = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || (isHttps ? 443 : 80),
      path: parsedUrl.pathname + parsedUrl.search,
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {}),
      },
      rejectUnauthorized: false,
    };

    const req = lib.request(reqOptions, (res) => {
      let body = '';
      res.on('data', (chunk) => (body += chunk));
      res.on('end', () => {
        let parsedData = null;
        try {
          parsedData = JSON.parse(body);
        } catch {
          parsedData = body;
        }
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          data: parsedData,
        });
      });
    });

    req.on('error', reject);

    if (data) {
      req.write(typeof data === 'string' ? data : JSON.stringify(data));
    }
    req.end();
  });
}

async function runAudit() {
  console.log('================================================================');
  console.log('PHASE 28 — REAL USER ACCOUNT LIFECYCLE & PROVISIONING AUDIT');
  console.log('================================================================\n');

  // STEP 1: Super Admin & Hospital Admin Authentication
  console.log('--- Step 1: Base Administrative Authentication ---');
  const superAdminLogin = await request(`${LOCAL_URL}/api/auth/login`, {
    method: 'POST',
  }, {
    email: 'admin@biotrack.in',
    password: 'BioTrack@2026',
  });

  if (superAdminLogin.statusCode === 200 && superAdminLogin.data.accessToken) {
    logPass('Super Admin Login', `Authenticated as ${superAdminLogin.data.user.role}`);
  } else {
    logFail('Super Admin Login', `Status: ${superAdminLogin.statusCode}`);
    return;
  }
  const superAdminToken = superAdminLogin.data.accessToken;

  const hospitalAdminLogin = await request(`${LOCAL_URL}/api/auth/login`, {
    method: 'POST',
  }, {
    email: 'admin@citygeneral.in',
    password: 'BioTrack@2026',
  });

  if (hospitalAdminLogin.statusCode === 200 && hospitalAdminLogin.data.accessToken) {
    logPass('Hospital Admin Login', `Authenticated as ${hospitalAdminLogin.data.user.role} (${hospitalAdminLogin.data.user.facilityId})`);
  } else {
    logFail('Hospital Admin Login', `Status: ${hospitalAdminLogin.statusCode}`);
    return;
  }
  const hospitalAdminToken = hospitalAdminLogin.data.accessToken;
  const hospitalFacilityId = hospitalAdminLogin.data.user.facilityId;

  // STEP 2: Super Admin Provisions a Real Hospital User
  console.log('\n--- Step 2: Real User Provisioning (Super Admin) ---');
  const uniqueTimestamp = Date.now();
  const testUserEmail = `dr.ananya.${uniqueTimestamp}@citygeneral.in`;
  const testUserPassword = `DrSecure#${uniqueTimestamp}`;

  const provisionRes = await request(`${LOCAL_URL}/api/users`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${superAdminToken}` },
  }, {
    name: 'Dr. Ananya Sen',
    email: testUserEmail,
    phone: '+91 98111 22334',
    role: 'HOSPITAL_STAFF',
    facilityId: hospitalFacilityId,
    password: testUserPassword,
  });

  let rawVerificationToken = null;
  if (provisionRes.statusCode === 201) {
    logPass('User Provisioned', `Created user ${provisionRes.data.email} with role ${provisionRes.data.role}`);
    
    // Verify no password hash or internal secret leaks
    if (!provisionRes.data.passwordHash && !provisionRes.data.emailVerificationTokenHash) {
      logPass('Data Leak Prevention', 'No passwordHash or tokenHash exposed in provisioning response');
    } else {
      logFail('Data Leak Prevention', 'Sensitive hash field detected in response body!');
    }

    // Extract verification token from verificationUrl for verification test
    if (provisionRes.data.verificationUrl) {
      const parsed = new URL(provisionRes.data.verificationUrl);
      rawVerificationToken = parsed.searchParams.get('token');
      logPass('Verification Dispatch', `Verification URL generated successfully: ${provisionRes.data.verificationUrl}`);
    }
  } else {
    logFail('User Provisioned', `Status: ${provisionRes.statusCode} Body: ${JSON.stringify(provisionRes.data)}`);
    return;
  }
  const testUserId = provisionRes.data.id;

  // STEP 3: Unverified User Login Gate
  console.log('\n--- Step 3: Unverified Account Login Gate ---');
  const unverifiedLogin = await request(`${LOCAL_URL}/api/auth/login`, {
    method: 'POST',
  }, {
    email: testUserEmail,
    password: testUserPassword,
  });

  if (unverifiedLogin.statusCode === 403 && unverifiedLogin.data.message?.includes('Email address not verified')) {
    logPass('Unverified Login Blocked', `403 Forbidden - ${unverifiedLogin.data.message}`);
  } else {
    logFail('Unverified Login Blocked', `Status: ${unverifiedLogin.statusCode} Body: ${JSON.stringify(unverifiedLogin.data)}`);
  }

  // STEP 4: Email Verification Token Consumption
  console.log('\n--- Step 4: Cryptographic Email Verification ---');
  if (!rawVerificationToken) {
    logFail('Verification Token Check', 'No verification token extracted');
  } else {
    // Attempt verification with valid token
    const verifyRes = await request(`${LOCAL_URL}/api/auth/verify-email`, {
      method: 'POST',
    }, {
      token: rawVerificationToken,
    });

    if (verifyRes.statusCode === 200 || verifyRes.statusCode === 201) {
      logPass('Email Verification Succeeded', `Status: ${verifyRes.statusCode} - ${verifyRes.data.message}`);
    } else {
      logFail('Email Verification Succeeded', `Status: ${verifyRes.statusCode} Body: ${JSON.stringify(verifyRes.data)}`);
    }

    // Single-use token check: verify that re-using the same token fails
    const reVerifyRes = await request(`${LOCAL_URL}/api/auth/verify-email`, {
      method: 'POST',
    }, {
      token: rawVerificationToken,
    });

    if (reVerifyRes.statusCode === 400) {
      logPass('Single-Use Token Enforcement', `Re-used token rejected with 400 Bad Request`);
    } else {
      logFail('Single-Use Token Enforcement', `Expected 400, got ${reVerifyRes.statusCode}`);
    }
  }

  // STEP 5: Verified User Login & Role/Facility Authorization
  console.log('\n--- Step 5: Verified Real User Login & Session Verification ---');
  const verifiedLogin = await request(`${LOCAL_URL}/api/auth/login`, {
    method: 'POST',
  }, {
    email: testUserEmail,
    password: testUserPassword,
  });

  let testUserToken = null;
  if (verifiedLogin.statusCode === 200 && verifiedLogin.data.accessToken) {
    testUserToken = verifiedLogin.data.accessToken;
    logPass('Verified User Login', `Login successful, JWT accessToken received`);
    
    // Check user info
    if (verifiedLogin.data.user.emailVerified === true && verifiedLogin.data.user.role === 'HOSPITAL_STAFF') {
      logPass('JWT User State', `emailVerified: true, role: ${verifiedLogin.data.user.role}`);
    } else {
      logFail('JWT User State', `Unexpected user payload: ${JSON.stringify(verifiedLogin.data.user)}`);
    }
  } else {
    logFail('Verified User Login', `Status: ${verifiedLogin.statusCode} Body: ${JSON.stringify(verifiedLogin.data)}`);
  }

  // Profile lookup
  if (testUserToken) {
    const meRes = await request(`${LOCAL_URL}/api/users/me`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${testUserToken}` },
    });

    if (meRes.statusCode === 200 && meRes.data.role === 'HOSPITAL_STAFF' && meRes.data.facilityId === hospitalFacilityId) {
      logPass('GET /api/users/me Authoritative Profile', `Name: ${meRes.data.name}, Role: ${meRes.data.role}, Facility: ${meRes.data.facilityId}`);
    } else {
      logFail('GET /api/users/me Authoritative Profile', `Status: ${meRes.statusCode} Body: ${JSON.stringify(meRes.data)}`);
    }
  }

  // STEP 6: Hospital Admin Provisioning Within Their Own Facility
  console.log('\n--- Step 6: Hospital Admin Provisioning within Facility ---');
  const hospitalStaffEmail = `nurse.priya.${uniqueTimestamp}@citygeneral.in`;
  const hospitalStaffPassword = `NurseSecure#${uniqueTimestamp}`;

  const hospAdminProvisionRes = await request(`${LOCAL_URL}/api/users`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${hospitalAdminToken}` },
  }, {
    name: 'Nurse Priya Sharma',
    email: hospitalStaffEmail,
    role: 'HOSPITAL_STAFF',
    password: hospitalStaffPassword,
  });

  if (hospAdminProvisionRes.statusCode === 201 && hospAdminProvisionRes.data.facilityId === hospitalFacilityId) {
    logPass('Hospital Admin Provisioning', `Created staff under facility ${hospAdminProvisionRes.data.facilityId}`);
  } else {
    logFail('Hospital Admin Provisioning', `Status: ${hospAdminProvisionRes.statusCode} Body: ${JSON.stringify(hospAdminProvisionRes.data)}`);
  }

  // STEP 7: Security & Privilege Boundary Tests
  console.log('\n--- Step 7: Security & Privilege Boundary Tests ---');

  // Test 7a: Hospital Admin attempting to create Super Admin (Forbidden)
  const illegalSuperAdminRes = await request(`${LOCAL_URL}/api/users`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${hospitalAdminToken}` },
  }, {
    name: 'Rogue Admin',
    email: `rogue.${uniqueTimestamp}@bad.in`,
    role: 'SUPER_ADMIN',
    password: 'RoguePassword#2026',
  });
  if (illegalSuperAdminRes.statusCode === 403) {
    logPass('RBAC: Hospital Admin -> Super Admin Blocked', `403 Forbidden`);
  } else {
    logFail('RBAC: Hospital Admin -> Super Admin Blocked', `Status: ${illegalSuperAdminRes.statusCode}`);
  }

  // Test 7b: Hospital Admin attempting to create Collection Staff (Forbidden)
  const illegalCollectionRes = await request(`${LOCAL_URL}/api/users`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${hospitalAdminToken}` },
  }, {
    name: 'Rogue Collector',
    email: `rogue.collector.${uniqueTimestamp}@bad.in`,
    role: 'COLLECTION_STAFF',
    password: 'RoguePassword#2026',
  });
  if (illegalCollectionRes.statusCode === 403) {
    logPass('RBAC: Hospital Admin -> Collection Staff Blocked', `403 Forbidden`);
  } else {
    logFail('RBAC: Hospital Admin -> Collection Staff Blocked', `Status: ${illegalCollectionRes.statusCode}`);
  }

  // Test 7c: Hospital Staff attempting to provision any user (Forbidden)
  if (testUserToken) {
    const staffProvisionRes = await request(`${LOCAL_URL}/api/users`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${testUserToken}` },
    }, {
      name: 'Unauthorized User',
      email: `unauth.${uniqueTimestamp}@bad.in`,
      role: 'HOSPITAL_STAFF',
      password: 'UnauthorizedPass#2026',
    });
    if (staffProvisionRes.statusCode === 403) {
      logPass('RBAC: Hospital Staff Provisioning Blocked', `403 Forbidden`);
    } else {
      logFail('RBAC: Hospital Staff Provisioning Blocked', `Status: ${staffProvisionRes.statusCode}`);
    }
  }

  // Test 7d: Unauthenticated provisioning attempt (Unauthorized)
  const unauthProvisionRes = await request(`${LOCAL_URL}/api/users`, {
    method: 'POST',
  }, {
    name: 'No Token User',
    email: `notoken.${uniqueTimestamp}@bad.in`,
    role: 'HOSPITAL_STAFF',
    password: 'NoTokenPassword#2026',
  });
  if (unauthProvisionRes.statusCode === 401) {
    logPass('Security: Unauthenticated Provisioning Blocked', `401 Unauthorized`);
  } else {
    logFail('Security: Unauthenticated Provisioning Blocked', `Status: ${unauthProvisionRes.statusCode}`);
  }

  // STEP 8: Duplicate Email Conflict
  console.log('\n--- Step 8: Duplicate Email Conflict Test ---');
  const duplicateRes = await request(`${LOCAL_URL}/api/users`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${superAdminToken}` },
  }, {
    name: 'Duplicate Ananya',
    email: testUserEmail,
    role: 'HOSPITAL_STAFF',
    facilityId: hospitalFacilityId,
    password: 'AnotherPassword#2026',
  });

  if (duplicateRes.statusCode === 409) {
    logPass('Duplicate Email Rejected', `409 Conflict - ${duplicateRes.data.message}`);
  } else {
    logFail('Duplicate Email Rejected', `Status: ${duplicateRes.statusCode} Body: ${JSON.stringify(duplicateRes.data)}`);
  }

  // STEP 9: User Deactivation Lifecycle
  console.log('\n--- Step 9: Administrative Account Deactivation Lifecycle ---');
  
  // Deactivate the test user
  const deactivateRes = await request(`${LOCAL_URL}/api/users/${testUserId}/status`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${superAdminToken}` },
  }, {
    status: 'DEACTIVATED',
  });

  if (deactivateRes.statusCode === 200 && deactivateRes.data.status === 'DEACTIVATED') {
    logPass('User Status Deactivated', `Target user status updated to DEACTIVATED`);
  } else {
    logFail('User Status Deactivated', `Status: ${deactivateRes.statusCode}`);
  }

  // Verify login attempt fails when deactivated
  const deactivatedLogin = await request(`${LOCAL_URL}/api/auth/login`, {
    method: 'POST',
  }, {
    email: testUserEmail,
    password: testUserPassword,
  });

  if (deactivatedLogin.statusCode === 403 && deactivatedLogin.data.message?.includes('deactivated')) {
    logPass('Deactivated User Login Blocked', `403 Forbidden - ${deactivatedLogin.data.message}`);
  } else {
    logFail('Deactivated User Login Blocked', `Status: ${deactivatedLogin.statusCode} Body: ${JSON.stringify(deactivatedLogin.data)}`);
  }

  // Reactivate user
  const reactivateRes = await request(`${LOCAL_URL}/api/users/${testUserId}/status`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${superAdminToken}` },
  }, {
    status: 'ACTIVE',
  });

  if (reactivateRes.statusCode === 200 && reactivateRes.data.status === 'ACTIVE') {
    logPass('User Status Reactivated', `Target user status restored to ACTIVE`);
  } else {
    logFail('User Status Reactivated', `Status: ${reactivateRes.statusCode}`);
  }

  // Verify login succeeds after reactivation
  const reactivatedLogin = await request(`${LOCAL_URL}/api/auth/login`, {
    method: 'POST',
  }, {
    email: testUserEmail,
    password: testUserPassword,
  });

  if (reactivatedLogin.statusCode === 200 && reactivatedLogin.data.accessToken) {
    logPass('Reactivated User Login Succeeded', `200 OK`);
  } else {
    logFail('Reactivated User Login Succeeded', `Status: ${reactivatedLogin.statusCode}`);
  }

  // STEP 10: Audit Log Verification
  console.log('\n--- Step 10: Dedicated AuditLog Verification ---');
  const auditRes = await request(`${LOCAL_URL}/api/audit-log`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${superAdminToken}` },
  });

  if (auditRes.statusCode === 200 && Array.isArray(auditRes.data)) {
    const logs = auditRes.data;
    const provisionLog = logs.find((l) => l.action === 'USER_PROVISIONED' && l.entityId === testUserId);
    const statusLog = logs.find((l) => l.action === 'USER_STATUS_UPDATED' && l.entityId === testUserId);

    if (provisionLog) {
      logPass('AuditLog: USER_PROVISIONED', `Found log entry for user ${testUserId} (Actor: ${provisionLog.actorUserId})`);
    } else {
      logFail('AuditLog: USER_PROVISIONED', `Missing USER_PROVISIONED log entry for user ${testUserId}`);
    }

    if (statusLog) {
      logPass('AuditLog: USER_STATUS_UPDATED', `Found log entry for status update on user ${testUserId}`);
    } else {
      logFail('AuditLog: USER_STATUS_UPDATED', `Missing USER_STATUS_UPDATED log entry`);
    }
  } else {
    logFail('AuditLog Query', `Status: ${auditRes.statusCode}`);
  }

  // STEP 11: Cross-Device / Cloudflare HTTPS Tunnel Connectivity
  console.log('\n--- Step 11: Cross-Origin HTTPS Tunnel Login Verification ---');
  const tunnelLogin = await request(`${TUNNEL_URL}/api/auth/login`, {
    method: 'POST',
    headers: {
      Origin: TUNNEL_URL,
    },
  }, {
    email: testUserEmail,
    password: testUserPassword,
  });

  if (tunnelLogin.statusCode === 200 && tunnelLogin.data.accessToken) {
    logPass('HTTPS Tunnel Login', `200 OK via ${TUNNEL_URL}`);
    
    // Verify profile lookup over tunnel
    const tunnelProfile = await request(`${TUNNEL_URL}/api/users/me`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${tunnelLogin.data.accessToken}`,
        Origin: TUNNEL_URL,
      },
    });

    if (tunnelProfile.statusCode === 200 && tunnelProfile.data.email === testUserEmail) {
      logPass('HTTPS Tunnel Profile Query', `Verified user ${tunnelProfile.data.name} via HTTPS Quick Tunnel`);
    } else {
      logFail('HTTPS Tunnel Profile Query', `Status: ${tunnelProfile.statusCode}`);
    }
  } else {
    logFail('HTTPS Tunnel Login', `Status: ${tunnelLogin.statusCode} Body: ${JSON.stringify(tunnelLogin.data)}`);
  }

  // STEP 12: Regression Integrity (Phase 25 & 27 Data)
  console.log('\n--- Step 12: Regression & Seeded Account Integrity ---');
  const phase25BatchRes = await request(`${LOCAL_URL}/api/waste-batches/8cea824b-ad67-45ad-954b-245bd58b97c7`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${superAdminToken}` },
  });

  if (phase25BatchRes.statusCode === 200 && phase25BatchRes.data.status === 'VERIFIED_CLOSED' && phase25BatchRes.data.wasteId === 'BMW-2026-000022') {
    logPass('Phase 25 Batch Integrity (BMW-2026-000022)', `Status: ${phase25BatchRes.data.status} (Waste ID: ${phase25BatchRes.data.wasteId})`);
  } else {
    logFail('Phase 25 Batch Integrity', `Status: ${phase25BatchRes.statusCode} Data: ${JSON.stringify(phase25BatchRes.data)}`);
  }

  console.log('\n================================================================');
  console.log(`AUDIT SUMMARY: ${passedTests}/${totalTests} TESTS PASSED`);
  console.log('================================================================');
}

runAudit().catch(console.error);
