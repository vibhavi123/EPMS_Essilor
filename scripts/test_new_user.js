#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * Test script for creating new users via the /api/users endpoint
 * Usage: node scripts/test_new_user.js [baseUrl] [authToken]
 */

const http = require('http');
const https = require('https');

// Configuration
const DEFAULT_BASE_URL = 'http://localhost:3000';
const DEFAULT_AUTH_HEADERS = {
  'Content-Type': 'application/json',
};

/**
 * Make HTTP/HTTPS request
 */
function makeRequest(url, options, body) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    const req = client.request(url, options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve({ status: res.statusCode, data: parsed });
        } catch (_e) {
          resolve({ status: res.statusCode, data });
        }
      });
    });

    req.on('error', reject);
    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

/**
 * Test case: Create user successfully
 */
async function testCreateUserSuccess(baseUrl) {
  console.log('\n✓ Test: Create user successfully');
  const newUser = {
    username: `testuser_${Date.now()}`,
    fullName: 'Test User',
    password: 'TestPass@1234',
    role: 'user',
    department: 'IT',
    company: 'TestCorp',
  };

  const options = {
    method: 'POST',
    headers: DEFAULT_AUTH_HEADERS,
  };

  try {
    const result = await makeRequest(`${baseUrl}/api/users`, options, newUser);
    if (result.status === 201 && result.data.success) {
      console.log('  ✓ Status: 201 Created');
      console.log(`  ✓ User created: ${result.data.data.username} (ID: ${result.data.data.id})`);
      return result.data.data;
    } else {
      console.log(`  ✗ Unexpected status: ${result.status}`);
      console.log(`  ✗ Response: ${JSON.stringify(result.data)}`);
      return null;
    }
  } catch (error) {
    console.log(`  ✗ Error: ${error.message}`);
    return null;
  }
}

/**
 * Test case: Create admin user
 */
async function testCreateAdminUser(baseUrl) {
  console.log('\n✓ Test: Create admin user');
  const newUser = {
    username: `admin_${Date.now()}`,
    fullName: 'Admin Test User',
    password: 'AdminPass@1234',
    role: 'admin',
    department: 'Management',
    company: 'TestCorp',
  };

  const options = {
    method: 'POST',
    headers: DEFAULT_AUTH_HEADERS,
  };

  try {
    const result = await makeRequest(`${baseUrl}/api/users`, options, newUser);
    if (result.status === 201 && result.data.success) {
      console.log('  ✓ Status: 201 Created');
      console.log(`  ✓ Admin user created: ${result.data.data.username}`);
      console.log(`  ✓ Role: ${result.data.data.role}`);
      return result.data.data;
    } else {
      console.log(`  ✗ Unexpected status: ${result.status}`);
      console.log(`  ✗ Response: ${JSON.stringify(result.data)}`);
      return null;
    }
  } catch (error) {
    console.log(`  ✗ Error: ${error.message}`);
    return null;
  }
}

/**
 * Test case: Missing required fields
 */
async function testMissingFields(baseUrl) {
  console.log('\n✓ Test: Missing required fields (should fail)');
  const incompleteUser = {
    username: `testuser_${Date.now()}`,
    // Missing fullName and password
  };

  const options = {
    method: 'POST',
    headers: DEFAULT_AUTH_HEADERS,
  };

  try {
    const result = await makeRequest(`${baseUrl}/api/users`, options, incompleteUser);
    if (result.status === 400 && !result.data.success) {
      console.log('  ✓ Status: 400 Bad Request (as expected)');
      console.log(`  ✓ Message: ${result.data.message}`);
    } else {
      console.log(`  ✗ Unexpected status: ${result.status}`);
      console.log(`  ✗ Response: ${JSON.stringify(result.data)}`);
    }
  } catch (error) {
    console.log(`  ✗ Error: ${error.message}`);
  }
}

/**
 * Test case: Duplicate username
 */
async function testDuplicateUsername(baseUrl) {
  console.log('\n✓ Test: Duplicate username (should fail)');
  const username = `testuser_${Date.now()}`;
  const newUser = {
    username,
    fullName: 'Test User',
    password: 'TestPass@1234',
  };

  const options = {
    method: 'POST',
    headers: DEFAULT_AUTH_HEADERS,
  };

  try {
    // Create first user
    const first = await makeRequest(`${baseUrl}/api/users`, options, newUser);
    if (first.status !== 201) {
      console.log('  ⚠ First user creation failed, skipping duplicate test');
      return;
    }

    // Try to create duplicate
    const second = await makeRequest(`${baseUrl}/api/users`, options, newUser);
    if (second.status === 409 && !second.data.success) {
      console.log('  ✓ Status: 409 Conflict (as expected)');
      console.log(`  ✓ Message: ${second.data.message}`);
    } else {
      console.log(`  ✗ Unexpected status: ${second.status}`);
      console.log(`  ✗ Response: ${JSON.stringify(second.data)}`);
    }
  } catch (error) {
    console.log(`  ✗ Error: ${error.message}`);
  }
}

/**
 * Test case: Create user with custom accessId
 */
async function testCreateUserWithAccessId(baseUrl) {
  console.log('\n✓ Test: Create user with custom accessId');
  const newUser = {
    username: `testuser_${Date.now()}`,
    fullName: 'Test User with AccessId',
    password: 'TestPass@1234',
    accessId: `CUSTOM_${Date.now()}`,
    role: 'user',
  };

  const options = {
    method: 'POST',
    headers: DEFAULT_AUTH_HEADERS,
  };

  try {
    const result = await makeRequest(`${baseUrl}/api/users`, options, newUser);
    if (result.status === 201 && result.data.success) {
      console.log('  ✓ Status: 201 Created');
      console.log(`  ✓ User created with accessId: ${result.data.data.accessId}`);
      return result.data.data;
    } else {
      console.log(`  ✗ Unexpected status: ${result.status}`);
      console.log(`  ✗ Response: ${JSON.stringify(result.data)}`);
      return null;
    }
  } catch (error) {
    console.log(`  ✗ Error: ${error.message}`);
    return null;
  }
}

/**
 * Test case: Create multiple users in batch
 */
async function testCreateMultipleUsers(baseUrl, count = 3) {
  console.log(`\n✓ Test: Create ${count} users in batch`);
  const users = [];
  const options = {
    method: 'POST',
    headers: DEFAULT_AUTH_HEADERS,
  };

  for (let i = 0; i < count; i++) {
    const newUser = {
      username: `batch_user_${Date.now()}_${i}`,
      fullName: `Batch User ${i + 1}`,
      password: 'BatchPass@1234',
      department: `Department ${i + 1}`,
    };

    try {
      const result = await makeRequest(`${baseUrl}/api/users`, options, newUser);
      if (result.status === 201 && result.data.success) {
        console.log(`  ✓ User ${i + 1}: ${result.data.data.username}`);
        users.push(result.data.data);
      } else {
        console.log(`  ✗ User ${i + 1} failed: ${result.status}`);
      }
    } catch (error) {
      console.log(`  ✗ User ${i + 1} error: ${error.message}`);
    }
  }

  return users;
}

/**
 * Run all tests
 */
async function runTests() {
  const baseUrl = process.argv[2] || DEFAULT_BASE_URL;

  console.log('='.repeat(60));
  console.log('USER CREATION API TESTS');
  console.log('='.repeat(60));
  console.log(`Base URL: ${baseUrl}`);

  // Run tests sequentially
  await testCreateUserSuccess(baseUrl);
  await testCreateAdminUser(baseUrl);
  await testMissingFields(baseUrl);
  await testDuplicateUsername(baseUrl);
  await testCreateUserWithAccessId(baseUrl);
  await testCreateMultipleUsers(baseUrl, 3);

  console.log('\n' + '='.repeat(60));
  console.log('TESTS COMPLETED');
  console.log('='.repeat(60));
}

// Run tests
runTests().catch(console.error);
