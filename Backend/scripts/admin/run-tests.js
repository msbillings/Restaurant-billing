#!/usr/bin/env node

/**
 * Comprehensive Test Runner
 * Runs all test suites and generates a report
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🧪 Restaurant Billing System - Test Suite\n');
console.log('='.repeat(50));

const testResults = {
  unit: { passed: 0, failed: 0, time: 0 },
  integration: { passed: 0, failed: 0, time: 0 },
  feature: { passed: 0, failed: 0, time: 0 }
};

function runTests(testType) {
  console.log(`\n📋 Running ${testType} tests...`);
  console.log('-'.repeat(50));
  
  const startTime = Date.now();
  
  try {
    const output = execSync(`npm run test:${testType}`, {
      encoding: 'utf-8',
      stdio: 'pipe'
    });
    
    const endTime = Date.now();
    const duration = ((endTime - startTime) / 1000).toFixed(2);
    
    // Parse test results (simplified)
    const passed = (output.match(/✓/g) || []).length;
    const failed = (output.match(/✕/g) || []).length;
    
    testResults[testType] = {
      passed,
      failed,
      time: duration
    };
    
    console.log(output);
    console.log(`\n✅ ${testType} tests completed in ${duration}s`);
    
    return true;
  } catch (error) {
    const endTime = Date.now();
    const duration = ((endTime - startTime) / 1000).toFixed(2);
    
    testResults[testType] = {
      passed: 0,
      failed: 1,
      time: duration
    };
    
    console.error(error.stdout || error.message);
    console.log(`\n❌ ${testType} tests failed in ${duration}s`);
    
    return false;
  }
}

// Main execution
async function main() {
  console.log('\n🚀 Starting comprehensive test suite...\n');
  
  // Check if server is running
  console.log('⚠️  Make sure your backend server is running on port 5000');
  console.log('   Start with: npm start\n');
  
  // Run test suites
  const unitPassed = runTests('unit');
  const integrationPassed = runTests('integration');
  const featurePassed = runTests('feature');
  
  // Summary
  console.log('\n' + '='.repeat(50));
  console.log('📊 TEST SUMMARY');
  console.log('='.repeat(50));
  
  const totalPassed = Object.values(testResults).reduce((sum, r) => sum + r.passed, 0);
  const totalFailed = Object.values(testResults).reduce((sum, r) => sum + r.failed, 0);
  const totalTime = Object.values(testResults).reduce((sum, r) => sum + parseFloat(r.time), 0);
  
  console.log(`\n✅ Passed: ${totalPassed}`);
  console.log(`❌ Failed: ${totalFailed}`);
  console.log(`⏱️  Total Time: ${totalTime.toFixed(2)}s\n`);
  
  console.log('Test Breakdown:');
  Object.entries(testResults).forEach(([type, results]) => {
    const status = results.failed === 0 ? '✅' : '❌';
    console.log(`  ${status} ${type}: ${results.passed} passed, ${results.failed} failed (${results.time}s)`);
  });
  
  if (totalFailed === 0) {
    console.log('\n🎉 All tests passed!');
    process.exit(0);
  } else {
    console.log('\n⚠️  Some tests failed. Please review the output above.');
    process.exit(1);
  }
}

main().catch(console.error);

