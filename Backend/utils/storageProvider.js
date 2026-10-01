import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';

// Storage configuration should come from environment.
// Do not crash the application if missing, instead fail backup operations safely.
const getS3Client = () => {
  if (!process.env.OBJECT_STORAGE_ENDPOINT && !process.env.OBJECT_STORAGE_BUCKET) {
    return null; // Storage disabled or absent
  }
  
  const config = {
    region: process.env.OBJECT_STORAGE_REGION || 'auto',
  };

  if (process.env.OBJECT_STORAGE_ENDPOINT) {
    config.endpoint = process.env.OBJECT_STORAGE_ENDPOINT;
  }

  if (process.env.OBJECT_STORAGE_ACCESS_KEY && process.env.OBJECT_STORAGE_SECRET_KEY) {
    config.credentials = {
      accessKeyId: process.env.OBJECT_STORAGE_ACCESS_KEY,
      secretAccessKey: process.env.OBJECT_STORAGE_SECRET_KEY
    };
  }

  // If credentials are absent, AWS SDK default credential chain (e.g. EC2 Instance Profile) is used.
  return new S3Client(config);
};

const getBucket = () => process.env.OBJECT_STORAGE_BUCKET;

export const isStorageEnabled = () => {
  return getS3Client() !== null && getBucket() !== undefined;
};

export const putObject = async (key, buffer) => {
  const client = getS3Client();
  if (!client) throw new Error('Object storage is not configured.');

  const command = new PutObjectCommand({
    Bucket: getBucket(),
    Key: key,
    Body: buffer
  });

  return await client.send(command);
};

export const getObject = async (key) => {
  const client = getS3Client();
  if (!client) throw new Error('Object storage is not configured.');

  const command = new GetObjectCommand({
    Bucket: getBucket(),
    Key: key
  });

  const response = await client.send(command);
  // Transform stream to buffer
  const chunks = [];
  for await (const chunk of response.Body) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
};

export const deleteObject = async (key) => {
  const client = getS3Client();
  if (!client) throw new Error('Object storage is not configured.');

  const command = new DeleteObjectCommand({
    Bucket: getBucket(),
    Key: key
  });

  return await client.send(command);
};

export const headObject = async (key) => {
  const client = getS3Client();
  if (!client) throw new Error('Object storage is not configured.');

  const command = new HeadObjectCommand({
    Bucket: getBucket(),
    Key: key
  });

  return await client.send(command);
};
