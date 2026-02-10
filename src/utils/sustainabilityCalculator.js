/**
 * Calculate sustainability metrics for a listing
 * @param {Object} listing - The listing object (app model)
 * @returns {Object} { sustainabilityScore: number, ecoImpactData: Object }
 */
const calculateSustainabilityMetrics = (listing) => {
  let score = 0;
  const details = {
    factors: [],
    estimatedSavings: {}
  };

  // 1. Condition Impact (Reuse vs New)
  if (listing.condition) {
    const conditionScoreMap = {
      'New': 0,          
      'Like New': 15,    
      'Good': 20,        
      'Fair': 25,        
      'Poor': 30
    };
    
    // Normalize condition string
    const conditionKey = Object.keys(conditionScoreMap).find(
      key => key.toLowerCase() === listing.condition.toLowerCase()
    );
    
    if (conditionKey) {
      const conditionScore = conditionScoreMap[conditionKey];
      score += conditionScore;
      details.factors.push({
        name: 'Condition',
        value: listing.condition,
        impact: conditionScore,
        description: `Extending lifecycle of ${listing.condition.toLowerCase()} item`
      });
    }
  }

  // 2. Category Impact (CO2/Water savings potential)
  if (listing.category) {
    const categoryImpactMap = {
      'Furniture': { 
        score: 25, 
        co2: '30kg', 
        water: '0L',
        citation: "EPA Waste Reduction Model (WARM): Wood Furniture"
      },
      'Electronics': { 
        score: 20, 
        co2: '20kg', 
        water: '500L',
        citation: "Apple Environmental Progress Report 2023 (iPhone/iPad Avg)" 
      },
      'Escooters': { 
        score: 30, 
        co2: '50kg', 
        water: '1000L',
        citation: "LCA of Shared Electric Scooters (ETH Zurich, 2019)"
      }, 
      'Kitchen': { 
        score: 15, 
        co2: '10kg', 
        water: '200L',
        citation: "Journal of Cleaner Production: Small Appliance LCA"
      },
      'Tickets': { 
        score: 5, 
        co2: '0kg', 
        water: '0L',
        citation: "Waste Prevention (Paperless/Unused Capacity)"
      }, 
      // Fallbacks
      'Clothing': { 
        score: 10, 
        co2: '5kg', 
        water: '2000L',
        citation: "Levi Strauss & Co. Life Cycle Assessment 2015"
      },
      'Books': { 
        score: 5, 
        co2: '1kg', 
        water: '100L',
        citation: "Green Press Initiative: Book Industry Climate Impacts"
      },
    };

    const categoryKey = Object.keys(categoryImpactMap).find(
      key => listing.category.toLowerCase().includes(key.toLowerCase())
    );

    if (categoryKey) {
      const impact = categoryImpactMap[categoryKey];
      score += impact.score;
      details.factors.push({
        name: 'Category',
        value: listing.category,
        impact: impact.score,
        description: `Category with high reuse impact`
      });
      details.estimatedSavings = {
        co2: impact.co2,
        water: impact.water,
        source: impact.citation 
      };
    }
  }

  // 3. Local Community Impact
  if (listing.livingCommunity) {
    const localScore = 10;
    score += localScore;
    details.factors.push({
      name: 'Local Transaction',
      value: listing.livingCommunity,
      impact: localScore,
      description: 'Reduced transportation emissions'
    });
  }

  // Cap score at 100
  score = Math.min(score, 100);

  return {
    sustainabilityScore: score,
    ecoImpactData: details
  };
};

module.exports = {
  calculateSustainabilityMetrics
};
