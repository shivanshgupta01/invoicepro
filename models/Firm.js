const mongoose = require('mongoose');

const FirmSchema = new mongoose.Schema({
  // FIX: This is now just a standard String to support Google/GitHub IDs!
  userId: { 
    type: String, 
    required: true 
  },
  name: { type: String, required: true },
  type: { type: String },
  color: { type: String },
  initial: { type: String },
  firmType: { type: String }, 
  
  // Registered Firm details
  gstin: { type: String, default: '' },
  address: { type: String, default: '' },
  mainMobile: { type: String, default: '' },
  altMobile: { type: String, default: '' },
  email: { type: String, default: '' },
  
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Firm', FirmSchema);