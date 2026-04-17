require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
const axios = require('axios');
const jwt = require('jsonwebtoken');

const app = express();

// ==========================================
// 1. MIDDLEWARES & SECURITY
// ==========================================
app.use(helmet({ contentSecurityPolicy: false }));

const baseUrl = process.env.NODE_ENV === 'production' 
  ? process.env.FRONTEND_URL || 'https://invoicepro-phi.vercel.app'
  : 'http://localhost:5000';

app.use(cors({
  origin: [baseUrl, 'http://localhost:5000', 'http://127.0.0.1:5500', 'http://localhost:5500', 'https://invoicepro-phi.vercel.app'],
  credentials: true,
}));

app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Initialize passport if configured
try {
  const passport = require('./config/passport');
  app.use(passport.initialize());
} catch(e) {
  console.log("⚠️ Passport config missing, skipping initialization.");
}

// ==========================================
// 2. CONNECT TO MONGODB ATLAS
// ==========================================
mongoose.connect(process.env.MONGODB_URI, {
  serverSelectionTimeoutMS: 5000,
  family: 4
})
  .then(() => console.log('✅ Connected to MongoDB Cloud!'))
  .catch((err) => console.error('❌ MongoDB Connection Error:', err.message));

const Invoice = require('./models/Invoice');

// ==========================================
// 3. SOCIAL OAUTH ROUTES (Google & GitHub)
// ==========================================

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
    }, { headers: { 'Accept': 'application/json' } });
    
    const accessToken = tokenRes.data.access_token;
    if (!accessToken) throw new Error('No access token received');

    const userRes = await axios.get('https://api.github.com/user', { headers: { 'Authorization': `Bearer ${accessToken}` } });
    const emailRes = await axios.get('https://api.github.com/user/emails', { headers: { 'Authorization': `Bearer ${accessToken}` } });
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

    const userRes = await axios.get('https://www.googleapis.com/oauth2/v2/userinfo', { headers: { 'Authorization': `Bearer ${accessToken}` } });
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
// 4. MAIN API ROUTES
// ==========================================

// Health Check
app.get('/api/health', (req, res) => res.json({ status: 'ok', message: 'InvoicePro Server Active!' }));

// Cloud Sync: Save Invoice
app.post('/api/invoices', async (req, res) => {
  try {
    const { invoiceData, userEmail } = req.body;
    if (!userEmail) return res.status(400).json({ success: false, message: 'User email required.' });

    await Invoice.findOneAndUpdate(
      { id: invoiceData.id },
      { ...invoiceData, userEmail: userEmail },
      { upsert: true, returnDocument: 'after' }
    );
    res.status(200).json({ success: true, message: 'Synced to MongoDB!' });
  } catch (error) {
    console.error('Cloud Save Error:', error);
    res.status(500).json({ success: false, message: 'Failed to sync.' });
  }
});

// Cloud Sync: Fetch Invoices
app.get('/api/invoices', async (req, res) => {
  try {
    const userEmail = req.query.email;
    if (!userEmail) return res.status(400).json({ success: false, message: 'Email required' });
    
    const userInvoices = await Invoice.find({ userEmail: userEmail });
    res.status(200).json({ success: true, data: userInvoices });
  } catch (error) {
    console.error('Cloud Fetch Error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch.' });
  }
});

// Load standard Auth (Email/Pass) and GST Routes if they exist
try {
  const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 20, message: { message: 'Too many attempts.' } });
  app.use('/api/auth', authLimiter, require('./routes/auth'));
  app.use('/api/gst', require('./routes/gst'));
} catch(e) {
  console.log("⚠️ Local auth/gst routes not found, skipping.");
}

// ==========================================
// 5. FRONTEND FALLBACK & ERROR HANDLING
// ==========================================
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'landing.html'));
});

app.use((err, req, res, next) => {
  console.error('SERVER ERROR:', err.message);
  res.status(500).json({ message: 'Internal Server Error' });
});

// ==========================================
// 6. EXPORT / START
// ==========================================

// Critical for Vercel
module.exports = app;

if (process.env.NODE_ENV !== 'production') {
  const PORT = process.env.PORT || 5000;
  app.listen(PORT, () => {
    console.log('');
    console.log('🚀 InvoicePro is running locally!');
    console.log(`   http://localhost:${PORT}`);
  });
}