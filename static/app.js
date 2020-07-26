const usernameInput = document.getElementById('username');
const button = document.getElementById('join_leave');
const shareScreen = document.getElementById('share_screen');
const container = document.getElementById('container');
const count = document.getElementById('count');
let connected = false;
let room;
let screenTrack;

function addLocalVideo() {
    Twilio.Video.createLocalVideoTrack().then(track => {
        let video = document.getElementById('local').firstChild;
        let trackElement = track.attach();
        trackElement.addEventListener('click', () => { zoomTrack(trackElement); });
        video.appendChild(trackElement);
    });
};

function connectButtonHandler(event) {
    event.preventDefault();
    if (!connected) {
        let username = usernameInput.value;
        if (!username) {
            alert('Ingrese su nombre antes de conectarse');
            return;
        }
        button.disabled = true;
        button.innerHTML = 'Connectandose...';
        connect(username).then(() => {
            button.innerHTML = 'Dejar la video llamada';
            button.disabled = false;
            shareScreen.disabled = false;
        }).catch(() => {
            alert('La conexión falló. ¿Se está ejecutando el backend?');
            button.innerHTML = 'Unirse a la videollamada';
            button.disabled = false;
        });
    } else {
        disconnect();
        button.innerHTML = 'Unirse a la videollamada';
        connected = false;
        shareScreen.innerHTML = 'Compartir pantalla';
        shareScreen.disabled = true;
    }
};

function connect(username) {
    let promise = new Promise((resolve, reject) => {
        // get a token from the back end
        fetch('/login', {
            method: 'POST',
            body: JSON.stringify({ 'username': username })
        }).then(res => res.json()).then(data => {
            // join video call
            return Twilio.Video.connect(data.token);
        }).then(_room => {
            room = _room;
            room.participants.forEach(participantConnected);
            room.on('participantConnected', participantConnected);
            room.on('participantDisconnected', participantDisconnected);
            connected = true;
            updateParticipantCount();
            resolve();
        }).catch(() => {
            reject();
        });
    });
    return promise;
};

function updateParticipantCount() {
    if (!connected)
        count.innerHTML = 'Desconectado';
    else
        count.innerHTML = (room.participants.size + 1) + ' participantes online.';
};

function participantConnected(participant) {
    let participantDiv = document.createElement('div');
    participantDiv.setAttribute('id', participant.sid);
    participantDiv.setAttribute('class', 'participant');

    let tracksDiv = document.createElement('div');
    participantDiv.appendChild(tracksDiv);

    let labelDiv = document.createElement('div');
    labelDiv.setAttribute('class', 'label');
    labelDiv.innerHTML = participant.identity;
    participantDiv.appendChild(labelDiv);

    container.appendChild(participantDiv);

    participant.tracks.forEach(publication => {
        if (publication.isSubscribed)
            trackSubscribed(tracksDiv, publication.track);
    });
    participant.on('trackSubscribed', track => trackSubscribed(tracksDiv, track));
    participant.on('trackUnsubscribed', trackUnsubscribed);

    updateParticipantCount();
};

function participantDisconnected(participant) {
    document.getElementById(participant.sid).remove();
    updateParticipantCount();
};

function trackSubscribed(div, track) {
    let trackElement = track.attach();
    trackElement.addEventListener('click', () => { zoomTrack(trackElement); });
    div.appendChild(trackElement);
};

function trackUnsubscribed(track) {
    track.detach().forEach(element => {
        if (element.classList.contains('participantZoomed')) {
            zoomTrack(element);
        }
        element.remove()
    });
};

function disconnect() {
    room.disconnect();
    while (container.lastChild.id != 'local')
        container.removeChild(container.lastChild);
    button.innerHTML = 'Unirse a la video llamada';
    connected = false;
    updateParticipantCount();
};

function shareScreenHandler() {
    event.preventDefault();
    if (!screenTrack) {
        navigator.mediaDevices.getDisplayMedia().then(stream => {
            screenTrack = new Twilio.Video.LocalVideoTrack(stream.getTracks()[0]);
            room.localParticipant.publishTrack(screenTrack);
            screenTrack.mediaStreamTrack.onended = () => { shareScreenHandler() };
            console.log(screenTrack);
            shareScreen.innerHTML = 'Dejar de compartir';
        }).catch(() => {
            alert('No se pudo compartir la pantalla.')
        });
    } else {
        room.localParticipant.unpublishTrack(screenTrack);
        screenTrack.stop();
        screenTrack = null;
        shareScreen.innerHTML = 'Compartir pantalla';
    }
};

function zoomTrack(trackElement) {
    if (!trackElement.classList.contains('participantZoomed')) {
        // zoom in
        container.childNodes.forEach(participant => {
            if (participant.className == 'participant') {
                participant.childNodes[0].childNodes.forEach(track => {
                    if (track === trackElement) {
                        track.classList.add('participantZoomed')
                    } else {
                        track.classList.add('participantHidden')
                    }
                });
                participant.childNodes[1].classList.add('participantHidden');
            }
        });
    } else {
        // zoom out
        container.childNodes.forEach(participant => {
            if (participant.className == 'participant') {
                participant.childNodes[0].childNodes.forEach(track => {
                    if (track === trackElement) {
                        track.classList.remove('participantZoomed');
                    } else {
                        track.classList.remove('participantHidden');
                    }
                });
                participant.childNodes[1].classList.remove('participantHidden');
            }
        });
    }
};

addLocalVideo();
button.addEventListener('click', connectButtonHandler);
shareScreen.addEventListener('click', shareScreenHandler);