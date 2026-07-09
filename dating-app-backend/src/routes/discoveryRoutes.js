const express = require('express');
const requireAuth = require('../middleware/requireAuth');
const asyncHandler = require('../middleware/asyncHandler');
const discoveryController = require('../controllers/discoveryController');
const swipeController = require('../controllers/swipeController');
const matchController = require('../controllers/matchController');

const router = express.Router();
router.use(requireAuth);

router.get('/discover', asyncHandler(discoveryController.getFeed));
router.post('/swipe', asyncHandler(swipeController.swipe));
router.get('/matches', asyncHandler(matchController.listMatches));

module.exports = router;
