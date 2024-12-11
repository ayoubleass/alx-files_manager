import DBClient from './utils/db';
const Bull = require('bull');
const { ObjectId } = require('mongodb');
const imageThumbnail = require('image-thumbnail');
const fs = require('fs');

const fileQueue = new Bull('fileQueue');

fileQueue.process(async (job) => {
  const { userId, fileId } = job.data;
  if (!userId) throw new Error('Missing userId');
  if (!fileId) throw new Error('Missing fileId');
  const file = await dbClient.db.collection('files').findOne({ _id: fileId, userId });
  if (!file) throw new Error('File not found');
  if (file.type !== 'image') throw new Error('File is not an image');
  const localPath = file.localPath;
  const sizes = [500, 250, 100];
  for (const size of sizes) {
    const thumbnailPath = `${localPath}_${size}.jpg`;
    const thumbnail = await imageThumbnail(localPath, { width: size });
    await fs.writeFile(thumbnailPath, thumbnail);
  }
});

