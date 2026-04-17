require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
require('dotenv').config();

const app = express();
app.use(express.json());

// --- CONNECT TO MONGODB ---
// --- CONNECT TO MONGODB ---
mongoose.connect(process.env.MONGODB_URI, {
  serverSelectionTimeoutMS: 5000,
  family: 4 // Forces IPv4
})
  .then(() => console.log('✅ Connected to MongoDB Cloud!'))
  .catch((err) => console.error('❌ MongoDB Connection Error:', err.message));



// At the top of your file, make sure you import the schema you created:
const Invoice = require('./models/Invoice');

// ─────────────────────────────────────────────────────────────
// CLOUD SYNC API ROUTES
// ─────────────────────────────────────────────────────────────

// 1. SAVE OR UPDATE AN INVOICE
app.post('/api/invoices', async (req, res) => {
  try {
    const { invoiceData, userEmail } = req.body;

    if (!userEmail) {
      return res.status(400).json({ success: false, message: 'User email required for cloud sync.' });
    }

    // Upsert: If the invoice ID exists, update it. If not, create a new one.
    // This allows your "Modify" pages to update existing cloud documents!
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

// 2. FETCH ALL INVOICES FOR A LOGGED-IN USER
app.get('/api/invoices/:email', async (req, res) => {
  try {
    const userEmail = req.params.email;
    
    // Find every invoice across all document types that belong to this user
    const userInvoices = await Invoice.find({ userEmail: userEmail });
    
    res.status(200).json({ success: true, data: userInvoices });
  } catch (error) {
    console.error('Cloud Fetch Error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch cloud data.' });
  }
});  



// ... rest of your server code ...
const cors       = require('cors');
const helmet     = require('helmet');
const rateLimit  = require('express-rate-limit');
const passport   = require('./config/passport');
const { initDB } = require('./config/db');
const path       = require('path');
const axios      = require('axios');
const jwt        = require('jsonwebtoken');


const PORT = process.env.PORT || 5000;

// ==========================================
// 1. MIDDLEWARES
// ==========================================

// Security headers
app.use(helmet({ contentSecurityPolicy: false }));

// Allow frontend to call the API
app.use(cors({
  origin: process.env.NODE_ENV === 'production'
    ? process.env.FRONTEND_URL
    : ['http://localhost:5000', 'http://127.0.0.1:5500', 'http://localhost:5500'],
  credentials: true,
}));

// Parse JSON request bodies
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true }));

// Init passport
app.use(passport.initialize());

// Serve HTML files from the public folder
app.use(express.static(path.join(__dirname, 'public')));


// ==========================================
// 2. SOCIAL OAUTH ROUTES
// ==========================================

// Dynamic URL handler so logins work locally AND on Vercel
const baseUrl = process.env.NODE_ENV === 'production' 
  ? process.env.FRONTEND_URL 
  : 'http://localhost:5000';

// --- GITHUB AUTH ---
app.get('/api/auth/github', (req, res) => {
  const redirect_uri = `${baseUrl}/api/auth/github/callback`;
  const url = `https://github.com/login/oauth/authorize?client_id=${process.env.GITHUB_CLIENT_ID}&redirect_uri=${redirect_uri}&scope=user:email`;
  res.redirect(url);
});

app.get('/api/auth/github/callback', async (req, res) => {
  const { code } = req.query;
  try {
    const tokenRes = await axios.post('https://github.com/login/oauth/access_token', {
      client_id: process.env.GITHUB_CLIENT_ID,
      client_secret: process.env.GITHUB_CLIENT_SECRET,
      code
    }, {
      headers: { 'Accept': 'application/json' }
    });
    
    const accessToken = tokenRes.data.access_token;
    if (!accessToken) throw new Error('No access token received');

    const userRes = await axios.get('https://api.github.com/user', {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    });
    
    const emailRes = await axios.get('https://api.github.com/user/emails', {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    });
    
    const primaryEmail = emailRes.data.find(e => e.primary)?.email || emailRes.data[0]?.email;

    const userPayload = {
      id: userRes.data.id,
      firstName: userRes.data.name ? userRes.data.name.split(' ')[0] : userRes.data.login,
      lastName: userRes.data.name ? userRes.data.name.split(' ').slice(1).join(' ') : '',
      email: primaryEmail
    };

    const token = jwt.sign({ user: userPayload }, process.env.JWT_SECRET, { expiresIn: '7d' });
    res.redirect(`${baseUrl}/landing.html?token=${token}`);

  } catch (error) {
    console.error('GitHub Auth Error:', error.message);
    res.redirect(`${baseUrl}/auth.html?error=github_failed`);
  }
});


// --- GOOGLE AUTH ---
app.get('/api/auth/google', (req, res) => {
  const redirect_uri = `${baseUrl}/api/auth/google/callback`;
  const url = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${process.env.GOOGLE_CLIENT_ID}&redirect_uri=${redirect_uri}&response_type=code&scope=profile email`;
  res.redirect(url);
});

app.get('/api/auth/google/callback', async (req, res) => {
  const { code } = req.query;
  try {
    const redirect_uri = `${baseUrl}/api/auth/google/callback`;
    
    const tokenRes = await axios.post('https://oauth2.googleapis.com/token', {
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      code,
      redirect_uri,
      grant_type: 'authorization_code'
    });
    
    const accessToken = tokenRes.data.access_token;
    if (!accessToken) throw new Error('No access token received');

    const userRes = await axios.get('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    });
    
    const userData = userRes.data;

    const userPayload = {
      id: userData.id,
      firstName: userData.given_name || userData.name,
      lastName: userData.family_name || '',
      email: userData.email
    };

    const token = jwt.sign({ user: userPayload }, process.env.JWT_SECRET, { expiresIn: '7d' });
    res.redirect(`${baseUrl}/landing.html?token=${token}`);

  } catch (error) {
    console.error('Google Auth Error:', error.message);
    res.redirect(`${baseUrl}/auth.html?error=google_failed`);
  }
});


// ==========================================
// 3. API ROUTES & RATE LIMITING
// ==========================================

// DEFINED FIRST: Rate limit auth routes — max 20 requests per 15 min per IP
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { message: 'Too many attempts. Try again in 15 minutes.' },
});

// Standard Auth API routes (Email/Password)
app.use('/api/auth', authLimiter, require('./routes/auth'));

// GST Routes
app.use('/api/gst', require('./routes/gst'));


// Health check — visit /api/health to test
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'InvoicePro server is running!' });
});


// ==========================================
// 4. FALLBACK & ERROR HANDLING
// ==========================================

// Serve landing.html for all other frontend routes
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

// Initialize Turso DB (Promises are handled for serverless environments)
initDB().catch(err => console.error("Database Init Error:", err));

// EXPORT THE APP FOR VERCEL
module.exports = app;

// ONLY LISTEN LOCALLY (Vercel manages the port automatically in production)
if (process.env.NODE_ENV !== 'production') {
  app.listen(PORT, () => {
    console.log('');
    console.log('🚀 InvoicePro is running locally!');
    console.log(`   http://localhost:${PORT}`);
    console.log(`   http://localhost:${PORT}/api/health`);
    console.log('');
  });
}

// Export the app for Vercel Serverless
module.exports = app;