// routes/gst.js
// ─────────────────────────────────────────────────────────────
//  GST verification route
//
//  Endpoint: GET /api/gst/verify/:gstin
//  Example:  GET /api/gst/verify/27AAAAA0000A1Z5
// ─────────────────────────────────────────────────────────────

const express = require('express');
const router  = express.Router();

// GET /api/gst/verify/:gstin
router.get('/verify/:gstin', async (req, res) => {
  const gstin = req.params.gstin.trim().toUpperCase();

  if (gstin.length !== 15) {
    return res.status(400).json({
      success: false,
      message: 'Invalid GSTIN length. Must be 15 characters.'
    });
  }

  try {
    // 1. Properly grab the variables from your .env file
    const apiHost = process.env.RAPIDAPI_HOST;
    const apiKey = process.env.RAPIDAPI_KEY;

    // Safety check just in case the .env is missing
    if (!apiHost || !apiKey) {
      console.error('SERVER ERROR: Missing RAPIDAPI_HOST or RAPIDAPI_KEY in .env file!');
      return res.status(500).json({ 
        success: false, 
        message: 'Server configuration error: Missing API keys.' 
      });
    }

    const url = `https://${apiHost}/getGSTDetailsUsingGST/${gstin}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'x-rapidapi-host': apiHost,
        'x-rapidapi-key':  apiKey,
        'Content-Type':    'application/json',
      },
    });

    // 2. Better Error Catching
    if (!response.ok) {
      // Pull the exact error from RapidAPI so you can see it in your terminal
      const errorText = await response.text(); 
      console.error(`❌ RapidAPI Error (Code ${response.status}):`, errorText);
      
      return res.status(response.status).json({
        success: false,
        message: `API Error (Code ${response.status}).`
      });
    }

    const apiData = await response.json();
    let dataContent = apiData.data;

    if (!dataContent) {
      return res.status(404).json({ success: false, message: 'No data found for this GSTIN.' });
    }

    // Handle both array and object responses
    const dataDict = Array.isArray(dataContent)
      ? dataContent[0]
      : dataContent;

    if (!dataDict) {
      return res.status(404).json({ success: false, message: 'No data found.' });
    }

    // Business name — prefer tradeName, fall back to legalName
    let businessName = dataDict.tradeName || '';
    if (!businessName || businessName.trim() === '') {
      businessName = dataDict.legalName || 'Name not found';
    }

    // Build address string
    const addrObj = dataDict?.principalAddress?.address || {};
    let addressString = 'Address not available';

    if (addrObj && Object.keys(addrObj).length > 0) {
      const parts = [
        addrObj.buildingNumber,
        addrObj.buildingName,
        addrObj.street,
        addrObj.location,
        addrObj.district,
        addrObj.stateCode,
        addrObj.pincode,
      ].filter(p => p && String(p).trim() !== '');

      addressString = parts.map(p => String(p).trim()).join(', ');
    }

    // Taxpayer type
    const taxpayerType = dataDict.taxType || 'Not Specified';

    return res.status(200).json({
      success: true,
      data: {
        business_name:  businessName,
        address:        addressString,
        taxpayer_type:  taxpayerType,
      }
    });

  } catch (err) {
    console.error('❌ GST fetch error:', err.message);
    return res.status(500).json({
      success: false,
      message: 'Failed to connect to GST API server.'
    });
  }
});

module.exports = router;