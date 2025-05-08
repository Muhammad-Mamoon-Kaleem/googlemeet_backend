import express from 'express';
import { v4 as uuidV4 } from 'uuid';
import http from 'http';
import { Server } from 'socket.io';
import { configDotenv } from 'dotenv';
import path from 'path';
import { createClient } from 'redis';
import { json } from 'stream/consumers';

configDotenv()
const app = express();
const server = http.createServer(app);
const io = new Server(server);
const port = process.env.PORT || 3000;
app.set('view engine', 'ejs');
app.use(express.static('views'));
const redisClient = createClient();
await redisClient.connect();
console.log('Redis is connected successfully.');

// app.use(express.static(path.join(path.dirname(new URL(import.meta.url).pathname), 'public')));
// app.set('views', path.join(path.dirname(new URL(import.meta.url).pathname), 'views'));

app.get('/', (req, res) => {
    const newRoomId = uuidV4();
    res.render('home', { newRoomId });
});


app.get('/room/:roomId', (req, res) => {
    res.render('room', { roomId: req.params.roomId })
})

io.on('connection', socket => {
    socket.on('joinroom', async(roomId, userId) => {
        socket.join(roomId);
        socket.roomId = roomId;
        socket.to(roomId).emit('user-connected', userId);

        const roomKey = `room:${socket.roomId}:messages`;
        try {
            const storeData =await redisClient.lRange(roomKey,0,-1);
            if(storeData.length>0){
                storeData.forEach(msg=>{
                    const msgObj = JSON.parse(msg);
                    console.log('retrive message',msgObj);
                    
                    socket.emit('createMessage',msgObj.message)
                })
            }
        }
         catch (error) {
            console.log("error in fetching messages from redis ",error);
            
        }
        socket.on('disconnect', () => {
            if (socket.roomId) {
                socket.to(roomId).emit('user-disconnected', userId);
            }
        });
    });

    socket.on('message', async (message) => {
        if (socket.roomId) {
            const roomKey = `room:${socket.roomId}:messages`;

            const data = {
                message,
                time: Date.now()
            };

            try {
                await redisClient.rPush(roomKey, JSON.stringify(data));
                console.log('message store to redis :', data);

                await redisClient.expire(roomKey, 20);
            }
            catch (error) {
                console.log('error in saving data to redis', error);
            }

            io.to(socket.roomId).emit('createMessage', message);
        }
    });
});


server.listen(port, () => console.log(`server is running on ${port} .`))
