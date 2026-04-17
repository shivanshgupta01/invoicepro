// models/Invoice.js
const mongoose = require('mongoose');

const invoiceSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true }, // The 'inv_123456789' ID
  userEmail: { type: String, required: true, index: true }, // Ties the invoice to the logged-in user!
  docType: { type: String, required: true }, // 'Sales Invoice', 'Quotation', etc.
  vchNo: { type: String },
  date: { type: String },
  
  // Using mongoose.Schema.Types.Mixed allows us to dump your existing JSON 
  // exactly as it is without writing out every single field!
  supplier: mongoose.Schema.Types.Mixed,
  party: mongoose.Schema.Types.Mixed,
  items: [mongoose.Schema.Types.Mixed],
  totals: mongoose.Schema.Types.Mixed,
  terms: mongoose.Schema.Types.Mixed,
  instructions: mongoose.Schema.Types.Mixed,
  
  status: { type: String, default: 'Saved' },
}, { timestamps: true }); // Automatically adds createdAt and updatedAt

module.exports = mongoose.model('Invoice', invoiceSchema);