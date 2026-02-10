const express = require('express');
const router = express.Router();

router.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', service: 'upload' });
});
const { PutObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const { v4: uuidv4 } = require('uuid');
const verifyToken = require('../middleware/auth');
const { s3Client } = require('../config/s3');

// Get a presigned URL for uploading an image
router.post('/presigned-url', verifyToken, async (req, res) => {
    try {
        const { fileType, folder = 'listings' } = req.body;
        const { uid } = req.user;

        if (!fileType) {
            return res.status(400).json({ message: 'File type is required' });
        }

        // Validate file type (basic check)
        const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];
        if (!allowedTypes.includes(fileType)) {
            return res.status(400).json({ message: 'Invalid file type. Only JPEG, PNG, and WebP are allowed.' });
        }

        // Generate a unique file name
        // Structure: listings/{userId}/{timestamp}-{uuid}.{ext}
        const extension = fileType.split('/')[1];
        const fileName = `${folder}/${uid}/${Date.now()}-${uuidv4()}.${extension}`;

        const command = new PutObjectCommand({
            Bucket: process.env.AWS_BUCKET_NAME,
            Key: fileName,
            ContentType: fileType,
            // ACL: 'public-read', // Optional: Depends on bucket policy. Better to use bucket policy for public access.
        });

        // Generate presigned URL (valid for 5 minutes)
        const presignedUrl = await getSignedUrl(s3Client, command, { expiresIn: 300 });

        // The public URL where the image will be accessible after upload
        // Note: This assumes the bucket is public or behind CloudFront.
        // If using CloudFront, this URL construction needs to change.
        const region = process.env.AWS_REGION;
        const bucket = process.env.AWS_BUCKET_NAME;
        const publicUrl = `https://${bucket}.s3.${region}.amazonaws.com/${fileName}`;

        res.json({
            presignedUrl,
            publicUrl,
            key: fileName
        });
    } catch (error) {
        console.error('Error generating presigned URL:', error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
});

module.exports = router;
