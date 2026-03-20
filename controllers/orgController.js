// controllers/orgController.js
// ISOLATION RULE: Every query MUST include { createdBy: req.user._id }
// A user only sees organizations THEY created — never another user's orgs.

const Organization = require('../models/Organization');
const Report       = require('../models/Report');
const Vulnerability= require('../models/Vulnerability');

// ── Create ─────────────────────────────────────────────────────────────────
// @route POST /api/organizations
exports.createOrg = async (req, res) => {
  try {
    const { name, description } = req.body;
    if (!name) return res.status(400).json({ success: false, message: 'Organization name is required' });

    let logo = '';
    if (req.file) logo = `/uploads/${req.file.filename}`;

    const org = await Organization.create({
      name,
      description: description || '',
      logo,
      createdBy: req.user._id,   // owner
      members:   [req.user._id], // also add as member for reference
      isActive: true,
    });

    res.status(201).json({ success: true, data: org });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── List — ONLY orgs created by THIS user ──────────────────────────────────
// @route GET /api/organizations
exports.getOrgs = async (req, res) => {
  try {
    // STRICT: only createdBy — never show other users' orgs
    const orgs = await Organization.find({
      createdBy: req.user._id,
      isActive:  true,
    })
      .populate('createdBy', 'name email')
      .sort({ createdAt: -1 });

    res.json({ success: true, count: orgs.length, data: orgs });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── Single org — only if this user created it ──────────────────────────────
// @route GET /api/organizations/:id
exports.getOrg = async (req, res) => {
  try {
    const org = await Organization.findOne({
      _id:       req.params.id,
      createdBy: req.user._id,    // CHAIN LOCK
    }).populate('createdBy', 'name email');

    if (!org) return res.status(404).json({ success: false, message: 'Organization not found' });
    res.json({ success: true, data: org });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── Update — only if this user created it ─────────────────────────────────
// @route PUT /api/organizations/:id
exports.updateOrg = async (req, res) => {
  try {
    const { name, description } = req.body;
    const update = {};
    if (name)        update.name        = name;
    if (description !== undefined) update.description = description;
    if (req.file)    update.logo        = `/uploads/${req.file.filename}`;

    const org = await Organization.findOneAndUpdate(
      { _id: req.params.id, createdBy: req.user._id },  // CHAIN LOCK
      update,
      { new: true, runValidators: true }
    );

    if (!org) return res.status(404).json({ success: false, message: 'Organization not found' });
    res.json({ success: true, data: org });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── Delete — only if this user created it ─────────────────────────────────
// @route DELETE /api/organizations/:id
exports.deleteOrg = async (req, res) => {
  try {
    const org = await Organization.findOneAndDelete({
      _id:       req.params.id,
      createdBy: req.user._id,    // CHAIN LOCK
    });
    if (!org) return res.status(404).json({ success: false, message: 'Organization not found' });

    // Cascade: delete all reports and vulnerabilities under this org that belong to this user
    const reports = await Report.find({ organizationId: org._id, createdBy: req.user._id });
    const reportIds = reports.map(r => r._id);

    await Vulnerability.deleteMany({ reportId: { $in: reportIds }, createdBy: req.user._id });
    await Report.deleteMany({ organizationId: org._id, createdBy: req.user._id });

    res.json({ success: true, message: 'Organization and all related data deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
