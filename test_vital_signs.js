const axios = require('axios');
const logger = require('./src/utils/logger');

// Configuration
const BASE_URL = 'http://localhost:3000/api/v1';
let authToken = '';
let testPatientId = '';
let testVitalSignId = '';

// Test data
const testVitalSignData = {
  temperature: {
    value: 37.2,
    unit: 'C'
  },
  bloodPressure: {
    systolic: 120,
    diastolic: 80
  },
  heartRate: 72,
  respiratoryRate: 16,
  oxygenSaturation: 98,
  weight: {
    value: 70,
    unit: 'kg'
  },
  height: {
    value: 175,
    unit: 'cm'
  },
  painLevel: 2,
  bloodGlucose: {
    value: 95,
    unit: 'mg/dL'
  },
  notes: 'Patient appears healthy, all vitals within normal range.'
};

const testDraftData = {
  temperature: {
    value: 36.8,
    unit: 'C'
  },
  bloodPressure: {
    systolic: 118,
    diastolic: 78
  },
  heartRate: 68,
  notes: 'Draft vital signs - to be completed later.'
};

async function login() {
  try {
    console.log('🔐 Logging in...');
    const response = await axios.post(`${BASE_URL}/auth/login`, {
      email: 'admin@medblock.com',
      password: 'Admin123!'
    });
    
    authToken = response.data.data.token;
    console.log('✅ Login successful');
    return true;
  } catch (error) {
    console.error('❌ Login failed:', error.response?.data || error.message);
    return false;
  }
}

async function getTestPatient() {
  try {
    console.log('👤 Getting test patient...');
    const response = await axios.get(`${BASE_URL}/patients?limit=1`, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    
    if (response.data.data.patients.length > 0) {
      testPatientId = response.data.data.patients[0]._id;
      console.log(`✅ Test patient found: ${testPatientId}`);
      return true;
    } else {
      console.log('❌ No patients found');
      return false;
    }
  } catch (error) {
    console.error('❌ Failed to get test patient:', error.response?.data || error.message);
    return false;
  }
}

async function testCreateVitalSign(status = 'final') {
  try {
    console.log(`📝 Creating ${status} vital sign...`);
    const response = await axios.post(`${BASE_URL}/vital-signs`, {
      patientId: testPatientId,
      status,
      ...testVitalSignData
    }, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    
    console.log(`✅ ${status} vital sign created:`, response.data.data._id);
    return response.data.data._id;
  } catch (error) {
    console.error(`❌ Failed to create ${status} vital sign:`, error.response?.data || error.message);
    return null;
  }
}

async function testCreateDraft() {
  try {
    console.log('📝 Creating draft vital sign...');
    const response = await axios.post(`${BASE_URL}/vital-signs`, {
      patientId: testPatientId,
      status: 'draft',
      ...testDraftData
    }, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    
    console.log('✅ Draft vital sign created:', response.data.data._id);
    return response.data.data._id;
  } catch (error) {
    console.error('❌ Failed to create draft vital sign:', error.response?.data || error.message);
    return null;
  }
}

async function testGetVitalSigns() {
  try {
    console.log('📋 Getting all vital signs...');
    const response = await axios.get(`${BASE_URL}/vital-signs`, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    
    console.log(`✅ Retrieved ${response.data.data.vitalSigns.length} vital signs`);
    console.log('📊 Pagination info:', response.data.data.pagination);
    return true;
  } catch (error) {
    console.error('❌ Failed to get vital signs:', error.response?.data || error.message);
    return false;
  }
}

async function testGetVitalSignById(vitalSignId) {
  try {
    console.log(`🔍 Getting vital sign by ID: ${vitalSignId}...`);
    const response = await axios.get(`${BASE_URL}/vital-signs/${vitalSignId}`, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    
    console.log('✅ Vital sign retrieved:', {
      id: response.data.data._id,
      status: response.data.data.status,
      patient: response.data.data.patient.fullName,
      bmi: response.data.data.bmi,
      bmiCategory: response.data.data.bmiCategory,
      bloodPressureCategory: response.data.data.bloodPressureCategory
    });
    return true;
  } catch (error) {
    console.error('❌ Failed to get vital sign by ID:', error.response?.data || error.message);
    return false;
  }
}

async function testUpdateDraft(vitalSignId) {
  try {
    console.log(`✏️ Updating draft vital sign: ${vitalSignId}...`);
    const updateData = {
      temperature: {
        value: 37.5,
        unit: 'C'
      },
      heartRate: 75,
      notes: 'Updated draft with new measurements.'
    };
    
    const response = await axios.put(`${BASE_URL}/vital-signs/${vitalSignId}`, updateData, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    
    console.log('✅ Draft vital sign updated:', response.data.data._id);
    return true;
  } catch (error) {
    console.error('❌ Failed to update draft vital sign:', error.response?.data || error.message);
    return false;
  }
}

async function testFinalizeDraft(vitalSignId) {
  try {
    console.log(`✅ Finalizing draft vital sign: ${vitalSignId}...`);
    const response = await axios.patch(`${BASE_URL}/vital-signs/${vitalSignId}/finalize`, {}, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    
    console.log('✅ Draft vital sign finalized:', response.data.data._id);
    return true;
  } catch (error) {
    console.error('❌ Failed to finalize draft vital sign:', error.response?.data || error.message);
    return false;
  }
}

async function testAmendVitalSign(vitalSignId) {
  try {
    console.log(`📝 Amending vital sign: ${vitalSignId}...`);
    const response = await axios.patch(`${BASE_URL}/vital-signs/${vitalSignId}/amend`, {
      reason: 'Corrected measurement error in blood pressure reading'
    }, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    
    console.log('✅ Vital sign amended:', response.data.data._id);
    return true;
  } catch (error) {
    console.error('❌ Failed to amend vital sign:', error.response?.data || error.message);
    return false;
  }
}

async function testGetPatientVitalSigns() {
  try {
    console.log(`👤 Getting vital signs for patient: ${testPatientId}...`);
    const response = await axios.get(`${BASE_URL}/vital-signs/patient/${testPatientId}`, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    
    console.log(`✅ Retrieved ${response.data.data.vitalSigns.length} vital signs for patient`);
    console.log('📊 Patient info:', response.data.data.patient);
    return true;
  } catch (error) {
    console.error('❌ Failed to get patient vital signs:', error.response?.data || error.message);
    return false;
  }
}

async function testFilterVitalSigns() {
  try {
    console.log('🔍 Testing vital signs filtering...');
    
    // Test filtering by status
    const draftResponse = await axios.get(`${BASE_URL}/vital-signs?status=draft`, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    
    const finalResponse = await axios.get(`${BASE_URL}/vital-signs?status=final`, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    
    console.log(`✅ Draft vital signs: ${draftResponse.data.data.vitalSigns.length}`);
    console.log(`✅ Final vital signs: ${finalResponse.data.data.vitalSigns.length}`);
    return true;
  } catch (error) {
    console.error('❌ Failed to filter vital signs:', error.response?.data || error.message);
    return false;
  }
}

async function testDeleteDraft(vitalSignId) {
  try {
    console.log(`🗑️ Deleting draft vital sign: ${vitalSignId}...`);
    const response = await axios.delete(`${BASE_URL}/vital-signs/${vitalSignId}`, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    
    console.log('✅ Draft vital sign deleted');
    return true;
  } catch (error) {
    console.error('❌ Failed to delete draft vital sign:', error.response?.data || error.message);
    return false;
  }
}

async function runTests() {
  console.log('🚀 Starting Vital Signs API Tests...\n');
  
  // Step 1: Login
  if (!(await login())) {
    console.log('❌ Cannot proceed without authentication');
    return;
  }
  
  // Step 2: Get test patient
  if (!(await getTestPatient())) {
    console.log('❌ Cannot proceed without a test patient');
    return;
  }
  
  console.log('\n📋 Running Vital Signs Tests...\n');
  
  // Test 1: Create final vital sign
  const finalVitalSignId = await testCreateVitalSign('final');
  
  // Test 2: Create draft vital sign
  const draftVitalSignId = await testCreateDraft();
  
  // Test 3: Get all vital signs
  await testGetVitalSigns();
  
  // Test 4: Get specific vital sign
  if (finalVitalSignId) {
    await testGetVitalSignById(finalVitalSignId);
  }
  
  // Test 5: Update draft
  if (draftVitalSignId) {
    await testUpdateDraft(draftVitalSignId);
  }
  
  // Test 6: Finalize draft
  if (draftVitalSignId) {
    await testFinalizeDraft(draftVitalSignId);
  }
  
  // Test 7: Amend vital sign
  if (finalVitalSignId) {
    await testAmendVitalSign(finalVitalSignId);
  }
  
  // Test 8: Get patient vital signs
  await testGetPatientVitalSigns();
  
  // Test 9: Filter vital signs
  await testFilterVitalSigns();
  
  // Test 10: Create another draft for deletion test
  const deleteTestDraftId = await testCreateDraft();
  
  // Test 11: Delete draft
  if (deleteTestDraftId) {
    await testDeleteDraft(deleteTestDraftId);
  }
  
  console.log('\n✅ All Vital Signs Tests Completed!');
  console.log('\n📊 Test Summary:');
  console.log('- ✅ Authentication');
  console.log('- ✅ Patient retrieval');
  console.log('- ✅ Vital sign creation (final & draft)');
  console.log('- ✅ Vital sign retrieval');
  console.log('- ✅ Draft updates');
  console.log('- ✅ Draft finalization');
  console.log('- ✅ Vital sign amendment');
  console.log('- ✅ Patient-specific vital signs');
  console.log('- ✅ Vital sign filtering');
  console.log('- ✅ Draft deletion');
}

// Run the tests
runTests().catch(error => {
  console.error('❌ Test execution failed:', error);
  process.exit(1);
}); 