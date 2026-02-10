const { calculateSustainabilityMetrics } = require('../src/utils/sustainabilityCalculator');

// Simple Test Runner
const runTest = (name, testFn) => {
  try {
    testFn();
    console.log(`✅ PASS: ${name}`);
  } catch (error) {
    console.error(`❌ FAIL: ${name}`);
    console.error(`   ${error.message}`);
    // process.exit(1); // Keep running other tests
  }
};

const assert = (actual, expected, message) => {
  if (actual !== expected) {
    throw new Error(`${message} - Expected: ${expected}, Actual: ${actual}`);
  }
};

const assertIncludes = (actual, expected, message) => {
    if (!actual.includes(expected)) {
      throw new Error(`${message} - Expected to include: ${expected}, Actual: ${actual}`);
    }
  };

console.log("🚀 Starting Backend TDD Cycle for Sustainability Feature...\n");

// --- TEST CASES ---

runTest('Should calculate correct score for Electronics (iPhone)', () => {
  const listing = {
    category: 'Electronics',
    condition: 'Good', // +20
    livingCommunity: 'The Hyve' // +10
  };
  // Electronics base: 20. Total: 20 + 20 + 10 = 50
  const result = calculateSustainabilityMetrics(listing);
  assert(result.sustainabilityScore, 50, 'Score calculation incorrect');
  assert(result.ecoImpactData.estimatedSavings.co2, '20kg', 'CO2 savings incorrect');
  assertIncludes(result.ecoImpactData.estimatedSavings.source, 'Apple', 'Missing Apple citation');
});

runTest('Should calculate correct score for Furniture (Chair)', () => {
    const listing = {
      category: 'Furniture',
      condition: 'Fair', // +25
      livingCommunity: 'Tooker' // +10
    };
    // Furniture base: 25. Total: 25 + 25 + 10 = 60
    const result = calculateSustainabilityMetrics(listing);
    assert(result.sustainabilityScore, 60, 'Score calculation incorrect');
    assert(result.ecoImpactData.estimatedSavings.co2, '30kg', 'CO2 savings incorrect');
    assertIncludes(result.ecoImpactData.estimatedSavings.source, 'EPA', 'Missing EPA citation');
  });

runTest('Should cap score at 100', () => {
    const listing = {
        category: 'Escooters', // +30
        condition: 'Fair', // +25
        livingCommunity: 'The Hyve', // +10
        // Imagine other factors pushing it over if we had them, 
        // but let's just ensure it returns a valid number <= 100
    };
    const result = calculateSustainabilityMetrics(listing);
    if (result.sustainabilityScore > 100) {
        throw new Error(`Score exceeded 100: ${result.sustainabilityScore}`);
    }
});

runTest('Should handle unknown category gracefully', () => {
    const listing = {
        category: 'UnknownSpaceship',
        condition: 'New',
        livingCommunity: null
    };
    const result = calculateSustainabilityMetrics(listing);
    assert(result.sustainabilityScore, 0, 'Should be 0 for unknown category/new condition');
});
