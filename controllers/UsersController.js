import sha1 from 'sha1';
import { ObjectId } from 'mongodb';
import redisClient from '../utils/redis';
import dbClient from '../utils/db';

class UsersController {
  static async postNew(req, res) {
    try {
      const { email, password } = req.body;
      if (!email) {
        return res.status(400).json({ error: 'Missing email' });
      }
      if (!password) {
        return res.status(400).json({ error: 'Missing password' });
      }
      const usersCollection = dbClient.db.collection('users');
      const user = await usersCollection.find({ email });
      if (user) {
        return res.status(400).json({ error: 'Already exist' });
      }
      const hashPwd = sha1(password);
      usersCollection.insertOne({ email, password: hashPwd });
      const newUser = await usersCollection.findOne({ email });
      return res.status(201).json({
        id: newUser._id,
        email: newUser.email,
      });
    } catch (err) {
      console.log(err);
      return res.status(500).json({ error: 'Server error' });
    }
  }

  static async getMe(req, res) {
    try {
      const connToken = req.header('X-Token');
      if (!connToken) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
      const key = `auth_${connToken}`;
      const userID = await redisClient.get(key);
      if (!userID) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
      const collection = dbClient.db.collection('users');
      const user = await collection.findOne({ _id: ObjectId(userID) });
      return res.status(200).json({
        id: user._id,
        email: user.email,
      });
    } catch (err) {
      console.log(err);
      return res.status(500).json({ error: 'Server error' });
    }
  }
}

export default UsersController;
