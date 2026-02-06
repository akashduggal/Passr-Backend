const { S3Client, PutBucketPolicyCommand, PutPublicAccessBlockCommand } = require('@aws-sdk/client-s3');
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

async function configureBucket() {
  if (!BUCKET_NAME) {
    console.error('Error: AWS_BUCKET_NAME is not set in .env');
    process.exit(1);
  }

  console.log(`Configuring bucket: ${BUCKET_NAME}...`);

  try {
    // 1. Disable "Block Public Access"
    console.log('Step 1: Disabling Block Public Access...');
    const publicAccessBlockParams = {
      Bucket: BUCKET_NAME,
      PublicAccessBlockConfiguration: {
        BlockPublicAcls: false,
        IgnorePublicAcls: false,
        BlockPublicPolicy: false,
        RestrictPublicBuckets: false,
      },
    };
    await s3Client.send(new PutPublicAccessBlockCommand(publicAccessBlockParams));
    console.log('✅ Block Public Access disabled.');

    // 2. Set Bucket Policy for Public Read
    console.log('Step 2: Setting Bucket Policy for Public Read...');
    const bucketPolicy = {
      Version: '2012-10-17',
      Statement: [
        {
          Sid: 'PublicReadGetObject',
          Effect: 'Allow',
          Principal: '*',
          Action: 's3:GetObject',
          Resource: `arn:aws:s3:::${BUCKET_NAME}/*`,
        },
      ],
    };

    const policyParams = {
      Bucket: BUCKET_NAME,
      Policy: JSON.stringify(bucketPolicy),
    };
    await s3Client.send(new PutBucketPolicyCommand(policyParams));
    console.log('✅ Bucket Policy set to Public Read.');

    console.log('\nSuccess! Your bucket is now configured to serve public images.');
    console.log('You should be able to view your uploaded images now.');

  } catch (error) {
    console.error('\n❌ Error configuring bucket:', error.message);
    if (error.Code === 'AccessDenied') {
      console.error('Tip: Ensure your IAM user has "s3:PutBucketPolicy" and "s3:PutPublicAccessBlock" permissions.');
    }
  }
}

configureBucket();
