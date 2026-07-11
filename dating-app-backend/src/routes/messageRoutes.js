const express = require('express');
const requireAuth = require('../middleware/requireAuth');
const { contentFilter } = require('../middleware/contentFilter');
const { validateSendMessage } = require('../middleware/validate');
const asyncHandler = require('../middleware/asyncHandler');
const messageController = require('../controllers/messageController');

const router = express.Router();

router.use(requireAuth);

router.get('/:matchId', asyncHandler(messageController.listMessages));
router.post('/:matchId', validateSendMessage, contentFilter(['message_text']), asyncHandler(messageController.sendMessage));
router.put('/:matchId/read', asyncHandler(messageController.markMessagesRead));

module.exports = router;
