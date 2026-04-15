// routes/gst.js
// ─────────────────────────────────────────────────────────────
//  GST verification route — mirrors your Python Flask code
//  but written for Node.js + Express.
//
//  Endpoint: GET /api/gst/verify/:gstin
//  Example:  GET /api/gst/verify/27AAAAA0000A1Z5
// ─────────────────────────────────────────────────────────────

const express = require('express');
const router  = express.Router();

const RAPIDAPI_HOST = 'gst-insights-api.p.rapidapi.com';
const RAPIDAPI_KEY  = '9327d10006mshbeeda76caddbf61p1b957ejsnfb3ec9ed10f7';

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
    const url = `https://${RAPIDAPI_HOST}/getGSTDetailsUsingGST/${gstin}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'x-rapidapi-host': RAPIDAPI_HOST,
        'x-rapidapi-key':  RAPIDAPI_KEY,
        'Content-Type':    'application/json',
      },
    });

    if (!response.ok) {
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

    // Handle both array and object responses — same as your Python code
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

    // Build address string — same logic as Python
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
    console.error('GST fetch error:', err.message);
    return res.status(500).json({
      success: false,
      message: 'Failed to connect to GST API server.'
    });
  }
});

module.exports = router;