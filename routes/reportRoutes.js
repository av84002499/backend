// routes/reportRoutes.js
const express = require('express');
const router  = express.Router();
const {
  createReport, getReports, getReport,
  updateReport, deleteReport, getDashboardStats,
} = require('../controllers/reportController');
const { protect }             = require('../middleware/authMiddleware');
const { requireReportOwner }  = require('../middleware/ownershipMiddleware');

router.use(protect);

router.get('/stats', getDashboardStats);

router.route('/')
  .get(getReports)
  .post(createReport);

router.route('/:id')
  .get(requireReportOwner, getReport)
  .put(requireReportOwner, updateReport)
  .delete(requireReportOwner, deleteReport);

module.exports = router;
