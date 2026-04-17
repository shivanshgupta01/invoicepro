require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const path = require('path');

const app = express();
app.use(express.json());

// ==========================================
// 1. CONNECT TO MONGODB ATLAS
// ==========================================
mongoose.connect(process.env.MONGODB_URI, {
  serverSelectionTimeoutMS: 5000,
  family: 4 // Forces IPv4 to prevent local connection errors
})
  .then(() => console.log('✅ Connected to MongoDB Cloud!'))
  .catch((err) => console.error('❌ MongoDB Connection Error:', err.message));

// ==========================================
// 2. IMPORT MODELS
// ==========================================
const Invoice = require('./models/Invoice');

// ==========================================
// 3. API ROUTES
// ==========================================

// Health check — visit /api/health to test
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'InvoicePro server is running on MongoDB!' });
});

// --- CLOUD SYNC API ROUTES (INVOICES) ---

// SAVE OR UPDATE AN INVOICE
app.post('/api/invoices', async (req, res) => {
  try {
    const { invoiceData, userEmail } = req.body;

    if (!userEmail) {
      return res.status(400).json({ success: false, message: 'User email required for cloud sync.' });
    }

    // Upsert: If the invoice ID exists, update it. If not, create a new one.
    await Invoice.findOneAndUpdate(
      { id: invoiceData.id },
      { ...invoiceData, userEmail: userEmail },
      { upsert: true, returnDocument: 'after' }
    );

    res.status(200).json({ success: true, message: 'Safely synced to MongoDB!' });
  } catch (error) {
    console.error('Cloud Save Error:', error);
    res.status(500).json({ success: false, message: 'Failed to sync to cloud.' });
  }
});

// FETCH ALL INVOICES FOR A LOGGED-IN USER
app.get('/api/invoices/:email', async (req, res) => {
  try {
    const userEmail = req.params.email;
    const userInvoices = await Invoice.find({ userEmail: userEmail });
    res.status(200).json({ success: true, data: userInvoices });
  } catch (error) {
    console.error('Cloud Fetch Error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch cloud data.' });
  }
});

// --- AUTH & EXTERNAL API ROUTES ---
try {
  // If you have these route files created, this will connect them
  app.use('/api/auth', require('./routes/auth'));
  app.use('/api/gst', require('./routes/gst'));
} catch (err) {
  console.log('⚠️ Note: Auth or GST route files not found or disabled. Continuing without them.');
}

// ==========================================
// 4. FRONTEND FALLBACK & ERROR HANDLING
// ==========================================

// Serve static frontend files (if your public folder is inside backend)
app.use(express.static(path.join(__dirname, 'public')));

// Serve landing.html for all other frontend routes (React/SPA fallback)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'landing.html'));
});

// Global error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: 'Something went wrong on the server.' });
});

// ==========================================
// 5. START SERVER / VERCEL EXPORT
// ==========================================

// EXPORT THE APP FOR VERCEL (Crucial for live deployment)
module.exports = app;

// ONLY LISTEN LOCALLY (Vercel manages the port automatically in production)
if (process.env.NODE_ENV !== 'production') {
  const PORT = process.env.PORT || 5000;
  app.listen(PORT, () => {
    console.log('');
    console.log('🚀 InvoicePro is running locally!');
    console.log(`   http://localhost:${PORT}`);
    console.log(`   http://localhost:${PORT}/api/health`);
  });
}