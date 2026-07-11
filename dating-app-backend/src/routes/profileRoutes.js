const express = require('express');
const multer = require('multer');
const requireAuth = require('../middleware/requireAuth');
const { contentFilter } = require('../middleware/contentFilter');
const asyncHandler = require('../middleware/asyncHandler');
const profileController = require('../controllers/profileController');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

// All routes here require authentication
router.use(requireAuth);

router.get('/', asyncHandler(profileController.getMyProfile));
router.put('/', contentFilter(['bio', 'profession']), asyncHandler(profileController.updateProfile));
router.post('/photos', upload.single('photo'), asyncHandler(profileController.uploadPhoto));
router.delete('/photos/:photoId', asyncHandler(profileController.deletePhoto));
router.put('/photos/reorder', asyncHandler(profileController.reorderPhotos));
router.delete('/', asyncHandler(profileController.deleteAccount));

// Kept for backward compatibility
router.patch('/bio', contentFilter(['bio']), asyncHandler(profileController.updateBio));

module.exports = router;
