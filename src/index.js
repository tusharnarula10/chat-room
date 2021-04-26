const path = require('path');
const http = require('http');
const express = require('express');
var MongoClient = require('mongodb').MongoClient;
const socketio = require('socket.io');
const { generatemsg } = require('./utils/messages');

const { addUser, removeUser, getUser, getUserInRoom } = require('./utils/users');


const app = express();
const server = http.createServer(app);
const io = socketio(server);

const PORT = process.env.PORT || 3000;

const publicdir = path.join(__dirname, '../public');

app.use(express.static(publicdir));

const url = "mongodb://localhost:27017/chat?poolSize=20&writeConcern=majority&retry=true";
var dbo;

MongoClient.connect(url, function(err, db) {
  if (err) throw err;
  dbo = db.db("chat");
  dbo.createCollection("users", function(err, res) {
    console.log("Collection created!");
  });
  dbo.createCollection("chat", function(err, res) {
    console.log("Collection created!");
  });
});


io.on("connection", (socket) => {
    console.log("new connection");

    socket.on("join", ({ username, room }, cb) => {

        const { error, user } = addUser({ id: socket.id, username, room });

        if (error) {
            return cb(error)
        }
        socket.join(user.room);
        socket.emit("message", generatemsg("Welcome to Chat App"));
        socket.broadcast.to(user.room).emit("message", generatemsg(`User ${user.username} has joined! Start Chatting now !!`));

        io.to(user.room).emit("roomData", {
            room: user.room,
            users: getUserInRoom(user.room)
        });
        dbo.collection("users").insertOne(user,(err,res)=>{
            if (err) throw err;
            console.log("user inserted");
        });
        cb();
    })

    socket.on("sendMessage", (msg, cb) => {
        const user = getUser(socket.id);
        io.to(user.room).emit("message", generatemsg(user.username, msg));
        dbo.collection("chat").insertOne({user:user.username,message:msg},(err,res)=>{
            if (err) throw err;
            console.log("chat inserted");
        });
        cb();
    })

    socket.on("disconnect", () => {
        const user = removeUser(socket.id);
        console.log(user);
        if (user) {
            io.to(user.room).emit("message", generatemsg(`Admin ${user.username} A user  has left`))

            io.to(user.room).emit("roomData", {
                room: user.room,
                users: getUserInRoom(user.room)
            })
        }

    })


})
server.listen(PORT, () => {
    console.log("server s up" + PORT);
})