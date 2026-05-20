const mongoose = require('mongoose');

// In-Memory Database Fallback Store
const memoryDb = {
  users: [], // Array of { _id, name, email, password }
  rooms: {}, // Map of roomId -> { roomId, participants: [], createdAt }
  messages: [] // Array of { _id, roomId, sender, message, timestamp }
};

let isConnectedToMongo = false;

// 1. Mongoose Schemas (If Connected)
const UserSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true }
});

const RoomSchema = new mongoose.Schema({
  roomId: { type: String, required: true, unique: true },
  participants: [{ type: String }],
  createdAt: { type: Date, default: Date.now }
});

const MessageSchema = new mongoose.Schema({
  roomId: { type: String, required: true },
  sender: { type: String, required: true }, // User Name
  message: { type: String, required: true },
  timestamp: { type: Date, default: Date.now }
});

let UserModel;
let RoomModel;
let MessageModel;

const connectDb = async () => {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.warn("\x1b[33m%s\x1b[0m", "⚠️  [DATABASE] MONGODB_URI env variable not found. Running in safe IN-MEMORY mode.");
    return false;
  }
  try {
    await mongoose.connect(uri);
    console.log("\x1b[32m%s\x1b[0m", "✅ [DATABASE] Connected to MongoDB Atlas successfully.");
    isConnectedToMongo = true;
    UserModel = mongoose.model('User', UserSchema);
    RoomModel = mongoose.model('Room', RoomSchema);
    MessageModel = mongoose.model('Message', MessageSchema);
    return true;
  } catch (err) {
    console.error("\x1b[31m%s\x1b[0m", `❌ [DATABASE] MongoDB connection error: ${err.message}`);
    console.warn("\x1b[33m%s\x1b[0m", "⚠️  [DATABASE] Falling back to IN-MEMORY storage mode.");
    isConnectedToMongo = false;
    return false;
  }
};

// 2. Abstracted Database Operations
const db = {
  connectDb,
  isConnected: () => isConnectedToMongo,

  // --- Users Operations ---
  createUser: async ({ name, email, password }) => {
    if (isConnectedToMongo) {
      const newUser = new UserModel({ name, email, password });
      return await newUser.save();
    } else {
      const existingUser = memoryDb.users.find(u => u.email === email);
      if (existingUser) {
        throw new Error('User already exists');
      }
      const newUser = {
        _id: 'usr_' + Math.random().toString(36).substr(2, 9),
        name,
        email,
        password
      };
      memoryDb.users.push(newUser);
      return newUser;
    }
  },

  findUserByEmail: async (email) => {
    if (isConnectedToMongo) {
      return await UserModel.findOne({ email });
    } else {
      return memoryDb.users.find(u => u.email === email) || null;
    }
  },

  findUserById: async (id) => {
    if (isConnectedToMongo) {
      return await UserModel.findById(id);
    } else {
      return memoryDb.users.find(u => u._id === id) || null;
    }
  },

  // --- Rooms Operations ---
  createRoom: async (roomId) => {
    if (isConnectedToMongo) {
      const newRoom = new RoomModel({ roomId, participants: [] });
      return await newRoom.save();
    } else {
      if (memoryDb.rooms[roomId]) {
        return memoryDb.rooms[roomId];
      }
      const newRoom = {
        roomId,
        participants: [],
        createdAt: new Date()
      };
      memoryDb.rooms[roomId] = newRoom;
      return newRoom;
    }
  },

  getRoom: async (roomId) => {
    if (isConnectedToMongo) {
      return await RoomModel.findOne({ roomId });
    } else {
      return memoryDb.rooms[roomId] || null;
    }
  },

  addParticipantToRoom: async (roomId, participantName) => {
    if (isConnectedToMongo) {
      return await RoomModel.findOneAndUpdate(
        { roomId },
        { $addToSet: { participants: participantName } },
        { new: true }
      );
    } else {
      const room = memoryDb.rooms[roomId];
      if (room) {
        if (!room.participants.includes(participantName)) {
          room.participants.push(participantName);
        }
        return room;
      }
      return null;
    }
  },

  // --- Message/Chat Operations ---
  saveMessage: async ({ roomId, sender, message }) => {
    if (isConnectedToMongo) {
      const newMessage = new MessageModel({ roomId, sender, message });
      return await newMessage.save();
    } else {
      const newMessage = {
        _id: 'msg_' + Math.random().toString(36).substr(2, 9),
        roomId,
        sender,
        message,
        timestamp: new Date()
      };
      memoryDb.messages.push(newMessage);
      return newMessage;
    }
  },

  getMessagesByRoom: async (roomId) => {
    if (isConnectedToMongo) {
      return await MessageModel.find({ roomId }).sort({ timestamp: 1 });
    } else {
      return memoryDb.messages.filter(m => m.roomId === roomId);
    }
  }
};

module.exports = db;
