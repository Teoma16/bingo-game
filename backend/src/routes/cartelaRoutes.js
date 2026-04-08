const express = require('express');
const router = express.Router();
const { Cartela } = require('../models');

// Get cartela by lucky number
router.get('/:luckyNumber', async (req, res) => {
  try {
    const { luckyNumber } = req.params;
    const cartela = await Cartela.findOne({
      where: { lucky_number: luckyNumber }
    });
    
    if (!cartela) {
      return res.status(404).json({ error: 'Cartela not found' });
    }
    
    res.json(cartela);
  } catch (error) {
    console.error('Error fetching cartela:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get all cartelas (for admin)
router.get('/', async (req, res) => {
  try {
    const cartelas = await Cartela.findAll({
      order: [['lucky_number', 'ASC']]
    });
    res.json(cartelas);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;