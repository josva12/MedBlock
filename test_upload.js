const fs = require('fs');
const path = require('path');

// Create a test file
const testContent = "This is a test medical report for testing file upload functionality.";
fs.writeFileSync('test_medical_report.txt', testContent);

console.log('Test file created: test_medical_report.txt');

// Instructions for testing
console.log('\nTo test the file upload, use one of these commands:');
console.log('\n1. With a valid JWT token (after successful login):');
console.log('curl -X POST http://localhost:3000/api/v1/patients/507f1f77bcf86cd799439011/files \\');
console.log('  -H "Authorization: Bearer YOUR_JWT_TOKEN" \\');
console.log('  -F "file=@test_medical_report.txt" \\');
console.log('  -F "fileType=medical_report" \\');
console.log('  -F "description=Test medical report upload"');

console.log('\n2. Check the logs for multer destination information:');
console.log('tail -f logs/app.log | grep "Custom multer destination"');

console.log('\n3. Check where the file was actually saved:');
console.log('find src/uploads -name "*.txt" -o -name "*.pdf"');

console.log('\nExpected behavior:');
console.log('- fileType=medical_report should save to src/uploads/documents/');
console.log('- fileType=xray should save to src/uploads/images/');
console.log('- fileType=other or invalid should save to src/uploads/others/'); 