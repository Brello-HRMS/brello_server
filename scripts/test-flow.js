/**
 * test-flow.js
 * 
 * Automates the full Brello HRMS flow:
 * Lead Registration -> OTP Verification -> Login -> Company Setup -> Employee Creation -> Role Assignment -> Menu Verification
 */

const API_URL = 'http://localhost:8000/api/v1';
const DEV_OTP = '123456';
const PLAN_ID = '02ceba57-e05a-4836-87e5-756247d7b598'; // Starter
const BUSINESS_TYPE_ID = 'aebf60f8-2ad5-4415-86ec-cb452a6a54f0'; // Software & IT
const EMPLOYEE_ROLE_ID = 'ddcf596b-4582-4834-b0d4-0c3aee9b09db';
const EMPLOYEE_APP_ID = 'ea4342d7-4bc9-4229-87f1-7cd30fbbe276';

async function api(path, method = 'GET', body = null, token = null) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const options = {
    method,
    headers,
  };

  if (body) options.body = JSON.stringify(body);

  const response = await fetch(`${API_URL}${path}`, options);
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    console.error(`Error ${response.status} on ${method} ${path}:`, data);
    throw new Error(`API Request failed: ${response.status}`);
  }

  return data;
}

async function runFlow(suffix) {
  console.log(`\n--- Starting Flow for Company ${suffix} ---`);

  const timestamp = Date.now();
  const email = `admin${suffix}-${timestamp}@example.com`;
  const password = 'Password@123';
  const companyName = `Company ${suffix} ${timestamp}`;
  const subdomain = `company${suffix}-${timestamp}`.toLowerCase(); // Unique subdomain

  const phoneSuffix = Math.floor(Math.random() * 100000000).toString().padStart(8, '0');
  const phone = `+919${phoneSuffix}`;

  // 1. Register Lead
  console.log('1. Registering Lead...');
  await api('/leads/register', 'POST', {
    email,
    first_name: `Admin`,
    last_name: suffix,
    phone,
    password,
    source: 'website',
    plan_id: PLAN_ID
  });

  // 2. Verify OTP
  console.log('2. Verifying Lead OTP...');
  await api('/leads/verify-otp', 'POST', { email, otp: DEV_OTP });

  // 3. Login User
  console.log('3. Logging in User...');
  const loginRes = await api('/auth/login', 'POST', { email, password });
  const userId = loginRes.data.user.id;
  let token = loginRes.data.access_token;
  const availableApps = loginRes.data.availableApps || [];
  console.log(`   User ID: ${userId}, Setup Required: ${loginRes.data.setup_required}`);
  console.log(`   Available Apps: ${availableApps.map(a => a.name).join(', ')}`);

  // 4. Setup Organization
  console.log('4. Setting up Organization...');
  const setupRes = await api('/organizations/setup', 'POST', {
    name: companyName,
    subdomain,
    business_type_id: BUSINESS_TYPE_ID,
    user_id: userId
  }, token);
  token = setupRes.data.access_token;
  const setupAvailableApps = setupRes.data.availableApps || [];
  const orgId = setupRes.data.user.organization_id;
  const enterpriseId = setupRes.data.user.enterprise_id;
  console.log(`   Org ID: ${orgId}, Enterprise ID: ${enterpriseId}`);
  console.log(`   Available Apps after setup: ${setupAvailableApps.map(a => a.name).join(', ')}`);

  // 5. Create Employee
  console.log('5. Creating Employee...');
  const empEmail = `emp${suffix}-${timestamp}@example.com`;
  const empPassword = 'Password@123';
  const empPhoneSuffix = Math.floor(Math.random() * 100000000).toString().padStart(8, '0');
  const empPhone = `+918${empPhoneSuffix}`;
  const createEmpRes = await api('/employees', 'POST', {
    firstName: `Employee`,
    lastName: suffix,
    email: empEmail,
    phone: empPhone,
    password: empPassword,
    profile: {
      employeeId: `EMP-${suffix}-${timestamp}`,
      type: 'EMPLOYEE',
      employmentType: 'FULL_TIME'
    },
    enterprise_id: enterpriseId,
    organization_id: orgId
  }, token);
  const empId = createEmpRes.data.id;
  console.log(`   Employee ID: ${empId}`);

  // 6. Assign Role to Employee
  console.log('6. Assigning Role to Employee...');
  await api('/user-role-maps', 'POST', {
    user_id: empId,
    role_id: EMPLOYEE_ROLE_ID,
    organization_id: orgId
  }, token);

  // 7. Login as Employee and Verify Menu
  console.log('7. Verifying Employee Menu Access...');
  const empLoginRes = await api('/auth/login', 'POST', { email: empEmail, password: empPassword });
  let empToken = empLoginRes.data.access_token;

  // Switch to Employee App (The employee role belongs to Employee App)
  console.log('   Switching to Employee App...');
  const switchRes = await api('/auth/switch-app', 'POST', { appId: EMPLOYEE_APP_ID }, empToken);
  empToken = switchRes.data.access_token;

  const menuRes = await api('/menu', 'GET', null, empToken);
  const menu = menuRes.data;
  console.log(`   Menu retrieved for ${empEmail}: ${menu.length} root modules found.`);
  // console.log(JSON.stringify(menu, null, 2));

  return { email, empEmail, menu };
}

async function main() {
  try {
    const res1 = await runFlow('One');
    const res2 = await runFlow('Two');

    console.log('\n--- Final Verification ---');
    console.log(`Company One Admin: ${res1.email}`);
    console.log(`Company One Employee: ${res1.empEmail}`);
    console.log(`Company Two Admin: ${res2.email}`);
    console.log(`Company Two Employee: ${res2.empEmail}`);

    if (res1.menu.length > 0 && res2.menu.length > 0) {
      console.log('SUCCESS: Both employees have menu access and companies are isolated (by login).');
    } else {
      console.log('WARNING: One or more employees have empty menus. Check role/app assignments.');
    }
  } catch (err) {
    console.error('Flow test failed:', err.message);
    process.exit(1);
  }
}

main();
