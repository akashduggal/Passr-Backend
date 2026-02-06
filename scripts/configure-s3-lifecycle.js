const { S3Client, PutBucketLifecycleConfigurationCommand } = require('@aws-sdk/client-s3');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables from parent directory
dotenv.config({ path: path.join(__dirname, '../.env') });

const s3Client = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

const BUCKET_NAME = process.env.AWS_BUCKET_NAME;
// Configurable expiry in days (S3 lifecycle minimum is 1 day)
const EXPIRY_DAYS = process.env.S3_IMAGE_EXPIRY_DAYS ? parseInt(process.env.S3_IMAGE_EXPIRY_DAYS) : 1;

async function configureLifecycle() {
  if (!BUCKET_NAME) {
    console.error('Error: AWS_BUCKET_NAME is not set in .env');
    process.exit(1);
  }

  console.log(`Configuring lifecycle for bucket: ${BUCKET_NAME}...`);
  console.log(`Setting object expiry to: ${EXPIRY_DAYS} day(s)`);

  try {
    const lifecycleConfig = {
      Bucket: BUCKET_NAME,
      LifecycleConfiguration: {
        Rules: [
          {
            ID: 'ExpireOldImages',
            Status: 'Enabled',
            Filter: {
              Prefix: 'listings/', // Apply only to listing images
            },
            Expiration: {
              Days: EXPIRY_DAYS,
            },
          },
        ],
      },
    };

    await s3Client.send(new PutBucketLifecycleConfigurationCommand(lifecycleConfig));
    console.log('✅ Lifecycle configuration applied successfully.');
    console.log(`Images in 'listings/' folder will now expire after ${EXPIRY_DAYS} day(s).`);

  } catch (error) {
    console.error('\n❌ Error configuring lifecycle:', error.message);
  }
}

configureLifecycle();
