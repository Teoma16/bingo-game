require('dotenv').config();
const { sequelize, Cartela } = require('../src/models');

// Generate random numbers within column ranges
function generateColumnNumbers(min, max, count) {
  const numbers = [];
  while (numbers.length < count) {
    const num = Math.floor(Math.random() * (max - min + 1)) + min;
    if (!numbers.includes(num)) {
      numbers.push(num);
    }
  }
  return numbers.sort((a, b) => a - b);
}

// Generate a single 5x5 cartela
function generateCartela() {
  const cartela = {
    B: generateColumnNumbers(1, 15, 5),
    I: generateColumnNumbers(16, 30, 5),
    N: generateColumnNumbers(31, 45, 5),
    G: generateColumnNumbers(46, 60, 5),
    O: generateColumnNumbers(61, 75, 5)
  };
  
  // Set free space (center of N column)
  cartela.N[2] = 'FREE';
  
  return cartela;
}

// Generate all 100 cartelas
async function generateAllCartelas() {
  try {
    await sequelize.authenticate();
    console.log('Database connected...');
    
    // Clear existing cartelas
    await Cartela.destroy({ where: {}, truncate: true });
    console.log('Cleared existing cartelas...');
    
    // Generate 100 unique cartelas
    for (let i = 1; i <= 200; i++) {
      const cartelaData = generateCartela();
      
      await Cartela.create({
        lucky_number: i,
        card_data: cartelaData
      });
      
      console.log(`Generated cartela for lucky number ${i}`);
    }
    
    console.log('Successfully generated all 100 cartelas!');
    process.exit(0);
  } catch (error) {
    console.error('Error generating cartelas:', error);
    process.exit(1);
  }
}

generateAllCartelas();