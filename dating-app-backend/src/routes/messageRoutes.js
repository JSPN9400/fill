const express = require('express');
const requireAuth = require('../middleware/requireAuth');
const { contentFilter } = require('../middleware/contentFilter');
const asyncHandler = require('../middleware/asyncHandler');
const messageController = require('../controllers/messageController');

const router = express.Router();

router.use(requireAuth);

router.get('/:matchId', asyncHandler(messageController.listMessages));
router.post('/:matchId', contentFilter(['message_text']), asyncHandler(messageController.sendMessage));

module.exports = router;
