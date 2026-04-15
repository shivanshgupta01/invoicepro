const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const { db } = require('../config/db'); // Importing your Turso database connection

// Middleware to verify user token
const protect = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'No token provided' });
  }
  
  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded.user || decoded; 
    next();
  } catch (err) {
    res.status(401).json({ message: 'Invalid token' });
  }
};

// GET: Fetch all firms for the logged-in user
router.get('/', protect, async (req, res) => {
  try {
    const userId = String(req.user.id || req.user._id);
    
    const result = await db.execute({
      sql: "SELECT * FROM firms WHERE userId = ? ORDER BY createdAt ASC",
      args: [userId]
    });

    res.json(result.rows);
  } catch (err) {
    console.error("GET Firms Error:", err);
    res.status(500).json({ message: 'Server error fetching firms' });
  }
});

// POST: Add a new firm
router.post('/', protect, async (req, res) => {
  try {
    const userId = String(req.user.id || req.user._id);
    // Generate a unique ID for the firm
    const firmId = 'f_' + Date.now();
    
    const { name, type, color, initial, firmType, gstin, address, mainMobile, altMobile, email } = req.body;

    await db.execute({
      sql: `INSERT INTO firms (id, userId, name, type, color, initial, firmType, gstin, address, mainMobile, altMobile, email) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        firmId, userId, name, type || '', color || '#4f6ef7', initial || name[0], 
        firmType || 'individual', gstin || '', address || '', mainMobile || '', altMobile || '', email || ''
      ]
    });

    // Send back the created firm object so the frontend can display it
    res.status(201).json({
      id: firmId, userId, name, type, color, initial, firmType, gstin, address, mainMobile, altMobile, email
    });
  } catch (err) {
    console.error("POST Firm Error:", err);
    res.status(500).json({ message: 'Server error saving firm', error: err.message });
  }
});

// DELETE: Remove a firm
router.delete('/:id', protect, async (req, res) => {
  try {
    const userId = String(req.user.id || req.user._id);
    
    await db.execute({
      sql: "DELETE FROM firms WHERE id = ? AND userId = ?",
      args: [req.params.id, userId]
    });

    res.json({ message: 'Firm deleted successfully' });
  } catch (err) {
    console.error("DELETE Firm Error:", err);
    res.status(500).json({ message: 'Server error deleting firm' });
  }
});

module.exports = router;