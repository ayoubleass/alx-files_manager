import { ObjectId } from 'mongodb';
import { v4 as uuidv4 } from 'uuid';
import { mkdir, writeFile } from 'fs';
import dbClient from '../utils/db';
import redisClient from '../utils/redis';

class FilesController {
  static async postUpload(req, res) {
    try {
      const FILE_TYPES = ['folder', 'file', 'image'];
      const dir = process.env.FOLDER_PATH || '/tmp/files_manager';
      const connToken = req.header('X-Token');
      const key = `auth_${connToken}`;
      const userId = await redisClient.get(key);
      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
      const user = await dbClient.db.collection('users').findOne({ _id: ObjectId(userId) });
      if (!user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
      const {
        name,
        type,
        data,
        parentId,
      } = req.body;
      if (!name) return res.status(400).json({ error: 'Missing name' });
      if (!type || !FILE_TYPES.includes(type)) return res.status(400).json({ error: 'Missing type' });
      if (!data && type !== FILE_TYPES[0]) return res.status(400).json({ error: 'Missing data' });
      const collection = dbClient.db.collection('files');
      if (parentId) {
        const parentFile = await collection.findOne({ _id: ObjectId(parentId) });
        if (!parentFile) res.status(400).json({ error: 'Parent not found' });
        if (!parentFile.type !== FILE_TYPES[0]) res.status(400).json({ error: 'Parent is not a folder' });
      }
      const isPublic = req.body.isPublic || false;
      const fileParentId = parentId || 0;
      const fileData = {
        userId: user._id,
        name,
        type,
        parentId: fileParentId,
        isPublic,
      };
      if (type === FILE_TYPES[0]) {
        const result = await collection.insertOne(fileData);
        const newFolder = await collection.findOne({ _id: result.insertedId });
        return res.status(201).json({
          id: newFolder._id,
          name: newFolder.name,
          userId: newFolder.userId,
          type: newFolder.type,
          parentId: newFolder.parentId,
          isPublic: newFolder.isPublic,
        });
      }
      const fileId = uuidv4();
      const filePath = `${dir}/${fileId}`;
      const decodedData = Buffer.from(data, 'base64');
      await mkdir(dir, { recursive: true }, (err) => {
        if (err) return res.status().json({ error: err.message });
        return true;
      });
      await writeFile(filePath, decodedData, (err) => {
        if (err) {
          return res.status(500).json({ error: err.message });
        }
        return true;
      });
      fileData.localPath = filePath;
      const result = await collection.insertOne(fileData);
      const newFile = await collection.findOne({ _id: result.insertedId });
      return res.status(201).json({
        id: newFile._id,
        userId: newFile.userId,
        name: newFile.name,
        type: newFile.type,
        parentId: newFile.parentId,
        isPublic: newFile.isPublic,
      });
    } catch (err) {
      console.log(err);
      return res.status(500).json({ error: 'Server error' });
    }
  }

  static async getShow(req, res) {
    const connToken = req.header('X-Token');
    const key = `auth_${connToken}`;
    const userId = await redisClient.get(key);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const user = await dbClient.db.collection('users').findOne({ _id: ObjectId(userId) });
    if (!user) return res.status(401).send({ error: 'Unauthorized' });
    const fileId = req.params.id || '';
    const collection = dbClient.db.collection('files');
    const file = await collection.findOne({ _id: ObjectId(fileId), userId: user._id });
    if (!file) return res.status(404).send({ error: 'Not found' });
    return res.status(200).json({
      id: file._id,
      userId: file.userId,
      name: file.name,
      type: file.type,
      isPublic: file.isPublic,
      parentId: file.parentId,
    });
  }

  static async getIndex(req, res) {
    const connToken = req.header('X-Token');
    const key = `auth_${connToken}`;
    const userId = await redisClient.get(key);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const user = await dbClient.db.collection('users').findOne({ _id: ObjectId(userId) });
    if (!user) return res.status(401).json({ error: 'Unauthorized' });
    let parentId = req.query.parentId || 0;
    if (parentId === '0') parentId = 0;
    const fileColl = dbClient.db.collection('files');
    if (parentId !== 0) {
      parentId = ObjectId(parentId);
      const folder = await fileColl.findOne({ _id: ObjectId(parentId) });
      if (!folder || folder.type !== 'folder') return res.status(200).json([]);
    }
    const page = req.query.page || 0;
    const agg = { $and: [{ parentId }] };
    let aggData = [{ $match: agg }, { $skip: page * 20 }, { $limit: 20 }];
    if (parentId === 0) aggData = [{ $skip: page * 20 }, { $limit: 20 }];
    const pageFiles = await fileColl.aggregate(aggData);
    const files = [];
    await pageFiles.forEach((file) => {
      const fileObj = {
        id: file._id,
        userId: file.userId,
        name: file.name,
        type: file.type,
        isPublic: file.isPublic,
        parentId: file.parentId,
      };
      files.push(fileObj);
    });
    return res.status(200).send(files);
  }

  static async putPublish(req, res) {
    const connToken = req.header('X-Token');
    const key = `auth_${connToken}`;
    const userId = await redisClient.get(key);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const user = await dbClient.db.collection('users').findOne({ _id: ObjectId(userId) });
    if (!user) return res.status(401).json({ error: 'Unauthorized' });
    const fileId = req.params.id || '';
    const fileCol = dbClient.db.collection('files');
    let file = await fileCol.findOne({ _id: ObjectId(fileId), userId: user._id });
    if (!file) return res.status(404).json({ error: 'Not found' });
    await fileCol.updateOne({ _id: ObjectId(fileId) }, { $set: { isPublic: true } });
    file = await fileCol.findOne({ _id: ObjectId(fileId), userId: user._id });
    return res.status(200).json({
      id: file._id,
      userId: file.userId,
      name: file.name,
      type: file.type,
      isPublic: file.isPublic,
      parentId: file.parentId,
    });
  }

  static async putUnpublish(req, res) {
    const connToken = req.header('X-Token');
    const key = `auth_${connToken}`;
    const userId = await redisClient.get(key);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const user = await dbClient.db.collection('users').findOne({ _id: ObjectId(userId) });
    if (!user) return res.status(401).json({ error: 'Unauthorized' });
    const fileId = req.params.id || '';
    const fileCol = dbClient.db.collection('files');
    let file = await fileCol.findOne({ _id: ObjectId(fileId), userId: user._id });
    if (!file) return res.status(404).json({ error: 'Not found' });
    await fileCol.updateOne({ _id: ObjectId(fileId) }, { $set: { isPublic: false } });
    file = await fileCol.findOne({ _id: ObjectId(fileId), userId: user._id });
    return res.status(200).json({
      id: file._id,
      userId: file.userId,
      name: file.name,
      type: file.type,
      isPublic: file.isPublic,
      parentId: file.parentId,
    });
  }
}

export default FilesController;
