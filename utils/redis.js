import { createClient } from 'redis';

const { promisify } = require('util');

class RedisClient {
  constructor() {
    this.client = createClient({});
    this.client.on('error', (err) => {
      console.error(`Redis client not connected to the server: ${err}`);
    });
    this.getAsync = promisify(this.client.get).bind(this.client);
  }

  isAlive() {
    return this.client.connected;
  }

  async get(key) {
    const value = await this.getAsync(key);
    return value;
  }

  async set(key, value, duration) {
    await this.client.setex(key, duration, value);
  }

  async del(key) {
    await this.client.del(key);
  }
}

const redisClient = new RedisClient();
export default redisClient;
