import { MongoClient } from 'mongodb';

class DBClient {
  constructor() {
    const HOST = process.env.DB_HOST || 'localhost';
    const PORT = process.env.BD_PORT || 27017;
    const url = `mongodb://${HOST}:${PORT}`;
    const database = process.env.DB_DATABASE || 'files_manager';
    this.db = null;
    this.connected = false;
    this.client = new MongoClient(url, { useUnifiedTopology: true });
    this.client.connect()
      .then((client) => {
        this.connected = true;
        this.db = client.db(database)})
      .catch((err) => {
	this.connected = false;
        console.error('Failed to connect to MongoDB', err);
      });
  }

  isAlive () {
    return this.connected;
  }

  async nbUsers() {
    const userCollection = this.db.collection('users');
    const numberOfUsers = await userCollection.countDocuments();
    return numberOfUsers;
  }

  async nbFiles() {
    const fileCollection = this.db.collection('files');
    const numberOfFiles = await fileCollection.countDocuments();
    return numberOfFiles;
  }
}

const dbClient = new DBClient();
export default dbClient;
