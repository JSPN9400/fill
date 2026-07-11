const express = require('express');
const requireAuth = require('../middleware/requireAuth');
const { contentFilter } = require('../middleware/contentFilter');
const asyncHandler = require('../middleware/asyncHandler');
const feelingsController = require('../controllers/feelingsController');
const publicProfileController = require('../controllers/publicProfileController');

const router = express.Router();
router.use(requireAuth);

router.get('/feelings', asyncHandler(feelingsController.getFeed));
router.post('/feelings', contentFilter(['feeling_text']), asyncHandler(feelingsController.postFeeling));
router.get('/users/:userId', asyncHandler(publicProfileController.getPublicProfile));

module.exports = router;
