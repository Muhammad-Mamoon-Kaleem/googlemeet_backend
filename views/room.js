const socket = io('/');
const videoGrid = document.getElementById('video-grid');
const myVideo = document.createElement('video');
myVideo.muted = true;

const peers = {};
let myVideoStream;

const peer = new Peer(undefined);

peer.on('open', (id) => {
    console.log('Peer connected with ID:', id);
    socket.emit('joinroom', ROOM_ID, id);
});

navigator.mediaDevices.getUserMedia({
    video: true,
    audio: true
}).then(stream => {
    myVideoStream = stream;
    addVideoStream(myVideo, stream);
    peer.on('call', call => {
        console.log('Incoming call from:', call.peer);
        call.answer(stream);
        const video = document.createElement('video');
        call.on('stream', userVideoStream => {
            console.log('Got remote stream from:', call.peer);
            addVideoStream(video, userVideoStream);
        });
        call.on('close', () => {
            console.log('Call closed with:', call.peer);
            video.remove();
        });
        call.on('error', (err) => {
            console.error('Call error:', err);
        });
    });
    socket.on('user-connected', userId => {
        console.log('User connected:', userId);
        setTimeout(() => {
            connectToNewUser(userId, stream);
        }, 1000);
    });
});

socket.on('user-disconnected', userId => {
    console.log(userId);
    if (peers[userId]) {
        peers[userId].close()
    }
})

// Add video stream 
function addVideoStream(video, stream) {
    video.srcObject = stream;
    video.addEventListener('loadedmetadata', () => {
        video.play();
    });
    videoGrid.append(video);
}

// Connect to new user (caller side)
function connectToNewUser(userId, stream) {
    console.log('Calling new user:', userId);
    const call = peer.call(userId, stream);

    const video = document.createElement('video');
    call.on('stream', userVideoStream => {
        console.log('Receiving stream from user:', userId);
        addVideoStream(video, userVideoStream);
    });

    call.on('close', () => {
        console.log('Call closed with:', userId);
        video.remove();
    });

    call.on('error', (err) => {
        console.error('Call error with user:', userId, err);
    });

    peers[userId] = call;
}

// Chat (example)
document.getElementById('sendButton').addEventListener('click', () => {
    const msg = document.getElementById('chatmessage').value;
    socket.emit('message', msg);
    document.getElementById('chatmessage').value = '';
});

socket.on('createMessage', message => {
    const msgElement = document.createElement('div');
    msgElement.innerText = message;
    document.getElementById('messages').append(msgElement);
});

// Mute/Unmute
document.getElementById('muteButton').addEventListener('click', () => {
    const enabled = myVideoStream.getAudioTracks()[0].enabled;
    myVideoStream.getAudioTracks()[0].enabled = !enabled;
});

// Video On/Off
document.getElementById('videoButton').addEventListener('click', () => {
    const enabled = myVideoStream.getVideoTracks()[0].enabled;
    myVideoStream.getVideoTracks()[0].enabled = !enabled;
});

// Screen Sharing

document.getElementById('shareScreen').addEventListener('click', () => {
    navigator.mediaDevices.getDisplayMedia({
        video: {
            cursor: true
        }
    }).then(screenStream => {
        const screenTrack = screenStream.getVideoTracks()[0];

        // Replace local video
        const myVideoTracks = myVideoStream.getVideoTracks();
        if (myVideoTracks.length > 0) {
            myVideo.srcObject = screenStream;
        }

        replaceVideoTrack(screenTrack)
        screenTrack.onended = () => {
            console.log('Screen sharing stopped. switching to camera.');
            myVideo.srcObject = myVideoStream;
            replaceVideoTrack(myVideoStream.getVideoTracks()[0])
        };
    }).catch(err => {
        console.error('Error accessing display media:', err);
    });
});

function replaceVideoTrack(VideoTrack) {
    Object.values(peer.connections).forEach(connectionArray => {
        connectionArray.forEach(connection => {
            const sender = connection.peerConnection.getSenders().find(s => s.track && s.track.kind === 'video');
            if (sender) {
                sender.replaceTrack(VideoTrack).catch(err => {
                    console.error('Error replacing track for peer:', err);
                });
            }
        });
    });
}
