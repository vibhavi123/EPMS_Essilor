#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * Quick test script to create a single new user
 * Usage: node scripts/quick_test_user.js [username] [fullName] [password] [role] [baseUrl]
 * Example: node scripts/quick_test_user.js john "John Doe" "Pass@1234" user http://localhost:3000
 */

const http = require('http');
const https = require('https');

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
          resolve({ status: res.statusCode, data: JSON.parse(data) });
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

async function createUser() {
  const args = process.argv.slice(2);
  const username = args[0] || `testuser_${Date.now()}`;
  const fullName = args[1] || 'Test User';
  const password = args[2] || 'TestPass@1234';
  const role = args[3] || 'user';
  const baseUrl = args[4] || 'http://localhost:3000';

  const userData = {
    username,
    fullName,
    password,
    role,
    department: 'IT',
    company: 'TestCorp',
  };

  console.log('Creating new user...\n');
  console.log('User Data:');
  console.log(JSON.stringify(userData, null, 2));

  const options = {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
  };

  try {
    const result = await makeRequest(`${baseUrl}/api/users`, options, userData);

    console.log(`\nResponse Status: ${result.status}`);
    console.log('Response Data:');
    console.log(JSON.stringify(result.data, null, 2));

    if (result.status === 201 && result.data.success) {
      console.log('\n✓ User created successfully!');
      return result.data.data;
    } else if (result.status === 409) {
      console.log('\n✗ Username already exists');
      return null;
    } else if (result.status === 400) {
      console.log('\n✗ Missing required fields');
      return null;
    } else {
      console.log('\n✗ Failed to create user');
      return null;
    }
  } catch (error) {
    console.error('\n✗ Error:', error.message);
    return null;
  }
}

createUser();
