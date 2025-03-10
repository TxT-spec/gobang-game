const express = require('express');
const http = require('http');
const socketIo = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: { origin: "*" },
  transports: ['polling', 'websocket']
});

const rooms = {};

io.on('connection', (socket) => {
  console.log('New client connected:', socket.id);

  socket.on('joinRoomRequest', () => {
    let roomId = Object.keys(rooms).find(room => rooms[room].length < 2) || `room${Object.keys(rooms).length}`;
    if (!rooms[roomId]) rooms[roomId] = [];
    if (rooms[roomId].length < 2) {
      socket.join(roomId);
      rooms[roomId].push(socket.id);
      socket.emit('assignRoom', roomId);
      io.to(roomId).emit('playerCount', rooms[roomId].length);
      if (rooms[roomId].length === 2) {
        io.to(roomId).emit('startGame');
      }
    }
  });

  socket.on('move', (data) => {
    socket.to(data.room).emit('opponentMove', data);
  });

  socket.on('ready', (roomId) => {
    if (rooms[roomId] && rooms[roomId].length === 2) {
      io.to(roomId).emit('startGame');
    }
  });

  socket.on('resetRoom', (roomId) => {
    io.to(roomId).emit('resetGame');
  });

  socket.on('disconnect', () => {
    for (let room in rooms) {
      rooms[room] = rooms[room].filter(id => id !== socket.id);
      if (rooms[room].length === 0) delete rooms[room];
      else io.to(room).emit('playerCount', rooms[room].length);
    }
  });
});

const port = process.env.PORT || 3000;
server.listen(port, () => {
  console.log(`Server running on port ${port}`);
});

module.exports = app;