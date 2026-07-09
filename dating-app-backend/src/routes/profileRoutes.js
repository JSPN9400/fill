const express = require('express');
const requireAuth = require('../middleware/requireAuth');
const { contentFilter } = require('../middleware/contentFilter');
const asyncHandler = require('../middleware/asyncHandler');
const profileController = require('../controllers/profileController');

const router = express.Router();

router.use(requireAuth);

router.patch('/bio', contentFilter(['bio']), asyncHandler(profileController.updateBio));

module.exports = router;
