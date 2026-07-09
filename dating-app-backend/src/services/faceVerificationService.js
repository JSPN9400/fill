require('dotenv').config();
const {
  RekognitionClient,
  DetectFacesCommand,
  SearchFacesByImageCommand,
  IndexFacesCommand,
} = require('@aws-sdk/client-rekognition');

const MOCK_MODE = process.env.MOCK_MODE === 'true';
const rekognition = MOCK_MODE ? null : new RekognitionClient({ region: process.env.AWS_REGION });
const COLLECTION_ID = process.env.REKOGNITION_COLLECTION_ID;
const DUPLICATE_MATCH_THRESHOLD = 92; // % similarity above which we treat it as "same person, already registered"

/**
 * Step 1: Basic quality/liveness sanity check.
 * Rejects images with no face, multiple faces, or very low confidence
 * (a real liveness check — blink/turn prompt — should also run on the
 * frontend/mobile SDK before this; this is a server-side backstop).
 */
async function checkFaceQuality(imageBytes) {
  if (MOCK_MODE) return { ok: true };

  const result = await rekognition.send(
    new DetectFacesCommand({ Image: { Bytes: imageBytes }, Attributes: ['DEFAULT'] })
  );

  if (!result.FaceDetails || result.FaceDetails.length === 0) {
    return { ok: false, reason: 'No face detected. Please retake the photo in good lighting.' };
  }
  if (result.FaceDetails.length > 1) {
    return { ok: false, reason: 'Multiple faces detected. Only your face should be in frame.' };
  }
  if (result.FaceDetails[0].Confidence < 90) {
    return { ok: false, reason: 'Face not clear enough. Please retake the photo.' };
  }
  return { ok: true };
}

/**
 * Step 2: Check whether this face already exists in our collection
 * (i.e. this person already has an account under a different phone/Gmail).
 * This is what enforces "one face = one account".
 */
async function findDuplicateFace(imageBytes) {
  if (MOCK_MODE) return { isDuplicate: false };

  try {
    const result = await rekognition.send(
      new SearchFacesByImageCommand({
        CollectionId: COLLECTION_ID,
        Image: { Bytes: imageBytes },
        FaceMatchThreshold: DUPLICATE_MATCH_THRESHOLD,
        MaxFaces: 1,
      })
    );
    if (result.FaceMatches && result.FaceMatches.length > 0) {
      return { isDuplicate: true, existingFaceId: result.FaceMatches[0].Face.FaceId };
    }
    return { isDuplicate: false };
  } catch (err) {
    // InvalidParameterException is thrown by Rekognition when the collection is empty — treat as "no duplicate"
    if (err.name === 'InvalidParameterException') return { isDuplicate: false };
    throw err;
  }
}

/**
 * Step 3: Store this face in the collection and return its unique FaceId,
 * which gets saved on the user's row (users.face_id).
 */
async function indexNewFace(imageBytes, externalUserRef) {
  if (MOCK_MODE) return `mock-face-${externalUserRef}-${Date.now()}`;

  const result = await rekognition.send(
    new IndexFacesCommand({
      CollectionId: COLLECTION_ID,
      Image: { Bytes: imageBytes },
      ExternalImageId: externalUserRef, // e.g. phone number or temp signup id, for traceability
      MaxFaces: 1,
      QualityFilter: 'AUTO',
    })
  );
  return result.FaceRecords[0].Face.FaceId;
}

module.exports = { checkFaceQuality, findDuplicateFace, indexNewFace };
