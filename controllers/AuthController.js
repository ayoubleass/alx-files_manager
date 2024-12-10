import sha1 from 'sha1';
import { v4 as uuidv4 } from 'uuid';
import redisClient from '../utils/redis';
import dbClient from '../utils/db';

class AuthController {
  static async getConnect(req, res) {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
      const [authType, data] = authHeader.split(' ');
      if (authType !== 'Basic' || !data) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
      const decodedData = Buffer.from(data, 'base64').toString();
      const [email, password] = decodedData.split(':');
      const collection = dbClient.db.collection('users');
      const user = await collection.findOne({ email });
      if (!user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
      const hashedPassword = sha1(password);
      if (hashedPassword !== user.password) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
      const token = uuidv4();
      const key = `auth_${token}`;
      const duration = (60 * 60 * 24);
      await redisClient.set(key, user._id.toString(), duration);
      return res.status(200).json({ token });
    } catch (err) {
      console.log(err);
      return res.status(500).json({ error: 'Server error' });
    }
  }

  static async getDisconnect(request, res) {
    try {
      const connToken = request.header('X-Token');
      const key = `auth_${connToken}`;
      const isValid = await redisClient.get(key);
      if (!isValid) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
      await redisClient.del(key);
      return res.status(204).json({});
    } catch (err) {
      console.log(err);
      return res.status(500).json({ error: 'Server error' });
    }
  }
}

export default AuthController;
