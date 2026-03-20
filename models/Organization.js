// models/Organization.js
const mongoose = require('mongoose');

const OrganizationSchema = new mongoose.Schema(
  {
    name:        { type: String, required: [true, 'Organization name is required'], trim: true },
    logo:        { type: String, default: '' },
    description: { type: String, default: '' },
    createdBy:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    members:     [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    isActive:    { type: Boolean, default: true },
  },
  { timestamps: true }
);

// Index for fast "list orgs by owner" queries
OrganizationSchema.index({ createdBy: 1, isActive: 1 });

module.exports = mongoose.model('Organization', OrganizationSchema);
