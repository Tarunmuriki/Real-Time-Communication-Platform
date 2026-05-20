const db = require('../models/db');

// Map of socket.id -> { userId, name, roomId }
const socketUserMap = new Map();

// Map of roomId -> Set of socket.ids
const roomSocketsMap = new Map();

module.exports = (io) => {
  io.on('connection', (socket) => {
    console.log(`🔌 Socket connected: ${socket.id}`);

    // 1. Join Room Event
    socket.on('join-room', async ({ roomId, user }) => {
      try {
        if (!roomId || !user) return;

        console.log(`👤 User '${user.name}' (${socket.id}) joining room: ${roomId}`);

        // Register user in the database room model
        await db.addParticipantToRoom(roomId, user.name);

        // Store user in socket session
        socketUserMap.set(socket.id, {
          userId: user.id || user._id,
          name: user.name,
          email: user.email,
          roomId: roomId
        });

        // Add socket to room map
        if (!roomSocketsMap.has(roomId)) {
          roomSocketsMap.set(roomId, new Set());
        }
        roomSocketsMap.get(roomId).add(socket.id);

        // Socket join room channel
        socket.join(roomId);

        // Fetch list of current participants in this room (excluding the newly joined user)
        const participants = [];
        roomSocketsMap.get(roomId).forEach((peerSocketId) => {
          if (peerSocketId !== socket.id) {
            const peerInfo = socketUserMap.get(peerSocketId);
            if (peerInfo) {
              participants.push({
                socketId: peerSocketId,
                user: {
                  id: peerInfo.userId,
                  name: peerInfo.name,
                  email: peerInfo.email
                }
              });
            }
          }
        });

        // Send existing participants list back to the newly joined client
        socket.emit('room-participants', participants);

        // Broadcast user-connected event to existing peers in the room
        socket.to(roomId).emit('user-connected', {
          socketId: socket.id,
          user: {
            id: user.id || user._id,
            name: user.name,
            email: user.email
          }
        });

        console.log(`Room ${roomId} has ${roomSocketsMap.get(roomId).size} client(s)`);

      } catch (error) {
        console.error('Error in join-room socket event:', error.message);
      }
    });

    // 2. WebRTC Mesh Signaling Relays
    // Relay SDP Offer
    socket.on('webrtc-offer', ({ targetSocketId, offer }) => {
      const senderInfo = socketUserMap.get(socket.id);
      if (senderInfo) {
        io.to(targetSocketId).emit('webrtc-offer', {
          senderSocketId: socket.id,
          senderName: senderInfo.name,
          offer
        });
      }
    });

    // Relay SDP Answer
    socket.on('webrtc-answer', ({ targetSocketId, answer }) => {
      io.to(targetSocketId).emit('webrtc-answer', {
        senderSocketId: socket.id,
        answer
      });
    });

    // Relay ICE Candidate
    socket.on('webrtc-candidate', ({ targetSocketId, candidate }) => {
      io.to(targetSocketId).emit('webrtc-candidate', {
        senderSocketId: socket.id,
        candidate
      });
    });

    // 3. Real-Time Chat Messaging
    socket.on('send-message', async ({ roomId, message }) => {
      try {
        const userInfo = socketUserMap.get(socket.id);
        if (!userInfo || userInfo.roomId !== roomId) return;

        // Save message in DB
        const savedMsg = await db.saveMessage({
          roomId,
          sender: userInfo.name,
          message
        });

        // Broadcast message to everyone in the room (including sender to unify timestamps)
        io.to(roomId).emit('receive-message', {
          id: savedMsg._id,
          roomId,
          sender: userInfo.name,
          message,
          timestamp: savedMsg.timestamp || new Date()
        });

      } catch (error) {
        console.error('Error in send-message socket event:', error.message);
      }
    });

    // 4. Whiteboard Draw Event Sync
    socket.on('draw', ({ roomId, drawData }) => {
      const userInfo = socketUserMap.get(socket.id);
      if (userInfo && userInfo.roomId === roomId) {
        // Broadcast drawing stroke to all other users in the room
        socket.to(roomId).emit('draw', drawData);
      }
    });

    // 5. Screen Share Signaling
    socket.on('screen-share', ({ roomId, isSharing }) => {
      const userInfo = socketUserMap.get(socket.id);
      if (userInfo && userInfo.roomId === roomId) {
        socket.to(roomId).emit('screen-share-state', {
          socketId: socket.id,
          name: userInfo.name,
          isSharing
        });
      }
    });

    // 6. Handle Disconnection
    socket.on('disconnect', () => {
      console.log(`🔌 Socket disconnected: ${socket.id}`);
      
      const userInfo = socketUserMap.get(socket.id);
      if (userInfo) {
        const { roomId, name } = userInfo;

        // Remove from socket session
        socketUserMap.delete(socket.id);

        // Remove from room sockets
        if (roomSocketsMap.has(roomId)) {
          const sockets = roomSocketsMap.get(roomId);
          sockets.delete(socket.id);
          if (sockets.size === 0) {
            roomSocketsMap.delete(roomId);
          }
        }

        // Broadcast to other peers in room
        socket.to(roomId).emit('user-disconnected', {
          socketId: socket.id,
          name: name
        });

        console.log(`👤 User '${name}' left room ${roomId}`);
      }
    });
  });
};
