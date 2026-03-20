// middleware/ownershipMiddleware.js
// Extra route-level guards that verify ownership BEFORE the controller runs.
// These provide a second layer of defence for sensitive operations.

const Organization = require('../models/Organization');
const Report       = require('../models/Report');
const Vulnerability= require('../models/Vulnerability');

/**
 * Verify the org in :id belongs to req.user
 * Use on: PUT /organizations/:id  DELETE /organizations/:id
 */
exports.requireOrgOwner = async (req, res, next) => {
  try {
    const org = await Organization.findOne({
      _id:       req.params.id,
      createdBy: req.user._id,
    });
    if (!org) return res.status(403).json({ success: false, message: 'Access denied — not your organization' });
    req.org = org;   // pass to controller if needed
    next();
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * Verify the report in :id belongs to req.user AND is under one of their orgs
 * Use on: PUT /reports/:id  DELETE /reports/:id  GET /reports/:id
 */
exports.requireReportOwner = async (req, res, next) => {
  try {
    const userOrgs   = await Organization.find({ createdBy: req.user._id, isActive: true }, '_id');
    const userOrgIds = userOrgs.map(o => o._id);

    const report = await Report.findOne({
      _id:            req.params.id,
      createdBy:      req.user._id,
      organizationId: { $in: userOrgIds },
    });
    if (!report) return res.status(403).json({ success: false, message: 'Access denied — not your report' });
    req.report = report;
    next();
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * Verify the vulnerability in :id belongs to req.user AND is under one of their reports
 * Use on: PUT /vulnerabilities/:id  DELETE /vulnerabilities/:id
 */
exports.requireVulnOwner = async (req, res, next) => {
  try {
    const userOrgs    = await Organization.find({ createdBy: req.user._id, isActive: true }, '_id');
    const userOrgIds  = userOrgs.map(o => o._id);
    const userReports = await Report.find({ createdBy: req.user._id, organizationId: { $in: userOrgIds } }, '_id');
    const userReportIds = userReports.map(r => r._id);

    const vuln = await Vulnerability.findOne({
      _id:       req.params.id,
      createdBy: req.user._id,
      reportId:  { $in: userReportIds },
    });
    if (!vuln) return res.status(403).json({ success: false, message: 'Access denied — not your vulnerability' });
    req.vuln = vuln;
    next();
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
