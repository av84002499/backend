// routes/orgRoutes.js
const express = require('express');
const router  = express.Router();
const {
  createOrg, getOrgs, getOrg,
  updateOrg, deleteOrg,
} = require('../controllers/orgController');
const { protect }          = require('../middleware/authMiddleware');
const { requireOrgOwner }  = require('../middleware/ownershipMiddleware');
const upload               = require('../middleware/uploadMiddleware');

router.use(protect);   // all routes require auth

router.route('/')
  .get(getOrgs)
  .post(upload.single('logo'), createOrg);

router.route('/:id')
  .get(requireOrgOwner, getOrg)
  .put(requireOrgOwner, upload.single('logo'), updateOrg)
  .delete(requireOrgOwner, deleteOrg);

module.exports = router;
