const express = require('express');
const router = express.Router();
const db = require('../models/db');
const authMiddleware = require('../middleware/authMiddleware');

// Generate custom formatted room ID: xxx-xxxx-xxx
function generateRoomId() {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  const segment = (len) => {
    let s = '';
    for (let i = 0; i < len; i++) {
      s += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return s;
  };
  return `${segment(3)}-${segment(4)}-${segment(3)}`;
}

// 1. Create a Room (Protected)
// POST /api/rooms/create
router.post('/create', authMiddleware, async (req, res) => {
  try {
    const roomId = generateRoomId();
    const room = await db.createRoom(roomId);
    
    res.status(201).json({
      success: true,
      message: 'Room created successfully.',
      roomId: room.roomId,
      participants: room.participants,
      createdAt: room.createdAt
    });
  } catch (error) {
    console.error('Create room error:', error.message);
    res.status(500).json({ success: false, message: 'Server room creation error. Please try again.' });
  }
});

// 2. Get/Verify a Room (Protected)
// GET /api/rooms/:id
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const roomId = req.params.id;
    const room = await db.getRoom(roomId);

    if (!room) {
      return res.status(404).json({ success: false, message: 'Room not found.' });
    }

    res.status(200).json({
      success: true,
      room: {
        roomId: room.roomId,
        participants: room.participants,
        createdAt: room.createdAt
      }
    });
  } catch (error) {
    console.error('Verify room error:', error.message);
    res.status(500).json({ success: false, message: 'Server room validation error.' });
  }
});

module.exports = router;
