window.onload = function(){
	// ########################## face detection ##########################
	var img = new Image();
	  img.src = 'assets/img/angry.png';
	  var video = document.getElementById('video');
	  var canvas = document.getElementById('canvas');
	  var remoteVideo = document.getElementById('remoteVideo');
	  //var video1 = document.getElementById('video1');
	  
	  var context = canvas.getContext('2d');
	  
	  var canvasStream = canvas.captureStream();
	  
	  //video1.srcObject = canvasStream;
	  //video1.onloadeddata = function(){
	  //    video1.play();
	  //};
      var tracker = new tracking.ObjectTracker('face');
      tracker.setInitialScale(1);
      tracker.setStepSize(1);
      tracker.setEdgesDensity(0.1);

      tracking.track('#video', tracker);
	  tracker.on('track', function(event) {
	    
		//context.clearRect(0, 0, canvas.width, canvas.height);
		context.drawImage(video, 0,0,320,240);

        event.data.forEach(function(rect) {		
		  //context.drawImage(img, rect.x,rect.y, rect.width,rect.height);
          //context.strokeStyle = '#a64ceb';
          //context.strokeRect(rect.x, rect.y, rect.width, rect.height);

          //context.fillStyle = "#a64ceb";
		  context.fillRect(rect.x,rect.y,rect.width,rect.height);
          //context.font = '11px Helvetica';
          //context.fillStyle = "#fff";
          //context.fillText('x: ' + rect.x + 'px', rect.x + rect.width + 5, rect.y + 11);
          //context.fillText('y: ' + rect.y + 'px', rect.x + rect.width + 5, rect.y + 22);
        });
      });
	
	
	//############################ RTC BLOCK ############################################
	if (!location.hash) {
	  location.hash = Math.floor(Math.random() * 0xFFFFFF).toString(16);
	}
	const roomHash = location.hash.substring(1);

	// webrtc demo created channel id.
	const drone = new ScaleDrone('n7heC3sYlfcOkmkU');
	// Room name needs to be prefixed with 'observable-'
	const roomName = 'observable-' + roomHash;
	const configuration = {
	  iceServers: [{
		urls: 'stun:stun.l.google.com:19302'
	  }]
	};
	let room;
	let pc;


	function onSuccess() {};
	function onError(error) {
	  console.error(error);
	};

	drone.on('open', error => {
	  if (error) {
		return console.error(error);
	  }
	  room = drone.subscribe(roomName);
	  room.on('open', error => {
		if (error) {
		  onError(error);
		}
	  });
	  // We're connected to the room and received an array of 'members'
	  // connected to the room (including us). Signaling server is ready.
	  room.on('members', members => {
		console.log('MEMBERS', members);
		// If we are the second user to connect to the room we will be creating the offer
		const isOfferer = members.length === 2;
		startWebRTC(isOfferer);
	  });
	});

	// Send signaling data via Scaledrone
	function sendMessage(message) {
		console.log(message);
	  drone.publish({
		room: roomName,
		message
	  });
	}

	function startWebRTC(isOfferer) {
	  pc = new RTCPeerConnection(configuration);

	  // 'onicecandidate' notifies us whenever an ICE agent needs to deliver a
	  // message to the other peer through the signaling server
	  pc.onicecandidate = event => {
		if (event.candidate) {
		  sendMessage({'candidate': event.candidate});
		}
	  };

	  // If user is offerer let the 'negotiationneeded' event create the offer
	  var isNegotiating =false;
	  if (isOfferer) {
		pc.onnegotiationneeded = () => {
			console.log("creating offer");
			if(isNegotiating){
				console.log("Skiping nested negotiation");
				return;
			}
			isNegotiating = true;
			pc.createOffer().then(localDescCreated).catch(onError);
		}
	  }
	  pc.onsignalingstatechange = (e) => {  // Workaround for Chrome: skip nested negotiations
		isNegotiating = (pc.signalingState != "stable");
	}

	  // When a remote stream arrives display it in the #remoteVideo element
	  pc.ontrack = event => {
		  console.log("event-->", event);
		const stream = event.streams[0];
		console.log(remoteVideo);
		
		if (!remoteVideo.srcObject || remoteVideo.srcObject.id !== stream.id) {
		  remoteVideo.srcObject = stream;
		  console.log("added -> remove video", remoteVideo);
		}
	  };

	  navigator.mediaDevices.getUserMedia({
		audio: true,
		video: true,
	  }).then(stream => {
		// Display your local video in #localVideo element
		video.srcObject = stream;
		// Add your stream to be sent to the conneting peer
		
		
		
		
		stream.getTracks().forEach(track => {
				console.log("adding this track-> ", track);
				if(track.kind=='audio'){
					console.log("audio stream added..");
					pc.addTrack(track, stream);
				}
			}
		);
		canvasStream.getTracks().forEach(track => {
			if(track.kind=='video'){
					console.log("video stream added..");
					pc.addTrack(track, stream);
			}
			console.log("found this track on canvas-->", track);
		});
		
		console.log(pc);
	  }, onError);

	  // Listen to signaling data from Scaledrone
	  room.on('data', (message, client) => {
		// Message was sent by us
		console.log(message, client);
		if (client.id === drone.clientId) {
		  return;
		}

		if (message.sdp) {
		  // This is called after receiving an offer or answer from another peer
		  pc.setRemoteDescription(new RTCSessionDescription(message.sdp), () => {
			// When receiving an offer lets answer it
			if (pc.remoteDescription.type === 'offer') {
			  pc.createAnswer().then(localDescCreated).catch(onError);
			}
		  }, onError);
		} else if (message.candidate) {
		  // Add the new ICE candidate to our connections remote description
		  pc.addIceCandidate(
			new RTCIceCandidate(message.candidate), onSuccess, onError
		  );
		}
	  });
	}
	

	function localDescCreated(desc) {
		console.log("local desc created--->", desc);
	  pc.setLocalDescription(
		desc,
		() => sendMessage({'sdp': pc.localDescription}),
		onError
	  );
	}
}
