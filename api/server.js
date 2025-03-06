const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  },
  transports: ['polling', 'websocket']
});

const rooms = {};
let roomCounter = 0;

app.use(express.static(__dirname));

io.on('connection', (socket) => {
  console.log('新玩家连接');

  socket.on('joinRoomRequest', () => {
    let room;
    for (const r in rooms) {
      if (rooms[r].players.length < 2) {
        room = r;
        break;
      }
    }
    if (!room) {
      room = `room${roomCounter++}`;
      rooms[room] = {
        board: Array(15).fill().map(() => Array(15).fill(null)),
        players: [],
        ready: 0
      };
    }
    socket.join(room);
    rooms[room].players.push(socket.id);
    socket.emit('assignRoom', room);
    io.to(room).emit('playerCount', rooms[room].players.length);
    console.log(`玩家 ${socket.id} 加入房间 ${room}`);
  });

  socket.on('ready', (room) => {
    if (rooms[room]) {
      rooms[room].ready++;
      console.log(`房间 ${room} 有 ${rooms[room].ready} 个玩家准备好`);
      if (rooms[room].ready === 2) {
        io.to(room).emit('startGame');
        rooms[room].ready = 0;
      }
    }
  });

  socket.on('move', (data) => {
    const { room, x, y, color } = data;
    if (rooms[room] && rooms[room].board[x][y] === null) {
      rooms[room].board[x][y] = color;
      io.to(room).emit('opponentMove', { x, y, color });
      console.log(`广播落子：x=${x}, y=${y}, color=${color}`);
    }
  });

  socket.on('resetRoom', (room) => {
    if (rooms[room]) {
      rooms[room].board = Array(15).fill().map(() => Array(15).fill(null));
      rooms[room].ready = 0;
      io.to(room).emit('resetGame');
    }
  });

  socket.on('disconnect', () => {
    console.log('玩家断开');
    for (const room in rooms) {
      const index = rooms[room].players.indexOf(socket.id);
      if (index !== -1) {
        rooms[room].players.splice(index, 1);
        rooms[room].ready = 0;
        io.to(room).emit('playerCount', rooms[room].players.length);
        if (rooms[room].players.length === 0) {
          delete rooms[room];
        } else {
          io.to(room).emit('resetGame');
        }
      }
    }
  });
});

module.exports = (req, res) => {
  // 将Express应用适配为Vercel的Serverless函数
  server.emit('request', req, res);
};