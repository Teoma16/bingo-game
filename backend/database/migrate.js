const { sequelize } = require('../src/models');

async function migrate() {
  try {
    console.log('🔄 Starting database migration...');
    
    // Sync all models with database
    await sequelize.sync({ alter: true });
    
    console.log('✅ Database migration completed successfully!');
    console.log('📋 All tables have been created/updated.');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

migrate();