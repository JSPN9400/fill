const express = require('express');
const requireAuth = require('../middleware/requireAuth');
const asyncHandler = require('../middleware/asyncHandler');
const notificationController = require('../controllers/notificationController');

const router = express.Router();

router.use(requireAuth);

router.get('/', asyncHandler(notificationController.listNotifications));
router.put('/read', asyncHandler(notificationController.markNotificationsRead));
router.get('/unread-count', asyncHandler(notificationController.getUnreadCount));

module.exports = router;
