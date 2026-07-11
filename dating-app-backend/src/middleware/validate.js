const { body, param, validationResult } = require('express-validator');

const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: errors.array()[0].msg, errors: errors.array() });
  }
  next();
};

const validateSendOtp = [
  body('phone_number')
    .trim()
    .notEmpty().withMessage('phone_number is required')
    .matches(/^\+?[1-9]\d{1,14}$/).withMessage('Invalid phone number format (must be E.164, e.g., +919876543210)'),
  handleValidationErrors
];

const validateVerifyOtp = [
  body('phone_number')
    .trim()
    .notEmpty().withMessage('phone_number is required')
    .matches(/^\+?[1-9]\d{1,14}$/).withMessage('Invalid phone number format'),
  body('code')
    .trim()
    .notEmpty().withMessage('OTP code is required')
    .isLength({ min: 6, max: 6 }).withMessage('OTP code must be 6 digits'),
  handleValidationErrors
];

const validateGoogleLogin = [
  body('google_id_token')
    .trim()
    .notEmpty().withMessage('google_id_token is required'),
  handleValidationErrors
];

const validateGoogleSignup = [
  body('reg_token').trim().notEmpty().withMessage('reg_token is required'),
  body('google_id_token').trim().notEmpty().withMessage('google_id_token is required'),
  handleValidationErrors
];

const validateIdVerify = [
  body('reg_token').trim().notEmpty().withMessage('reg_token is required'),
  body('id_document').isObject().withMessage('id_document must be an object'),
  body('id_document.type').trim().notEmpty().withMessage('id_document type is required'),
  body('id_document.number').trim().notEmpty().withMessage('id_document number is required'),
  handleValidationErrors
];

const validateCompleteProfile = [
  body('reg_token').trim().notEmpty().withMessage('reg_token is required'),
  body('name').trim().notEmpty().withMessage('name is required').escape(),
  body('dob').isISO8601().withMessage('dob must be a valid date (YYYY-MM-DD)'),
  body('gender').isIn(['male', 'female', 'other']).withMessage('gender must be male, female, or other'),
  body('interested_in').isArray({ min: 1 }).withMessage('interested_in must be an array of gender options'),
  body('interested_in.*').isIn(['male', 'female', 'other']).withMessage('Invalid interest gender option'),
  body('nationality').optional().trim().escape(),
  body('state').optional().trim().escape(),
  body('city').optional().trim().escape(),
  body('area').optional().trim().escape(),
  body('interests').optional().isArray().withMessage('interests must be an array of tags'),
  body('interests.*').optional().trim().escape(),
  body('profession').optional().trim().escape(),
  handleValidationErrors
];

const validateSwipe = [
  body('swipee_id').isInt().withMessage('swipee_id must be an integer'),
  body('swipe_type').isIn(['dislike', 'like', 'superlike']).withMessage('swipe_type must be dislike, like, or superlike'),
  handleValidationErrors
];

const validateSendMessage = [
  param('matchId').isInt().withMessage('matchId must be an integer'),
  body('message_text').trim().notEmpty().withMessage('message_text is required').escape(),
  handleValidationErrors
];

const validateUpdateBio = [
  body('bio').trim().notEmpty().withMessage('bio is required').escape(),
  handleValidationErrors
];

module.exports = {
  validateSendOtp,
  validateVerifyOtp,
  validateGoogleLogin,
  validateGoogleSignup,
  validateIdVerify,
  validateCompleteProfile,
  validateSwipe,
  validateSendMessage,
  validateUpdateBio
};
