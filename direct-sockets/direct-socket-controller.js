var encoder = new TextEncoder();
var local = new RTCPeerConnection({
  sdpSemantics: "unified-plan",
});
[
  "onsignalingstatechange",
  "oniceconnectionstatechange",
  "onicegatheringstatechange",
].forEach((e) => local.addEventListener(e, console.log));

local.onicecandidate = async (e) => {
  if (!e.candidate) {
    try {
      if (globalThis?.openIsolatedWebApp) {
        await openIsolatedWebApp(`?name=TCPSocket`);
      } else {
        setTitle(`?=TCPSocket`);
      }
      await scheduler.postTask(() => {}, {
        delay: 2200,
        priority: "user-visible",
      });
      console.log("sdp:", local.localDescription);
      var abortable = new AbortController();
      var { signal } = abortable;
      var request = await fetch("http://0.0.0.0:44819", {
        method: "post",
        body: new TextEncoder().encode(local.localDescription.sdp),
        signal,
      }).then((r) => r.text()).then(async (text) => {
        await local.setRemoteDescription({
          type: "answer",
          sdp: text,
        });
        console.log("Done signaling SDP");
      }).catch((e) => {
        console.log(e);
      });
    } catch (e) {
      console.error(e);
    }
  }
};
var channel = local.createDataChannel("transfer", {
  negotiated: true,
  ordered: true,
  id: 0,
  binaryType: "arraybuffer",
  protocol: "tcp",
});

channel.onopen = async (e) => {
  console.log(e.type, e.target);
};
channel.onclose = async (e) => {
  console.log(e.type, e.target);
};
channel.onclosing = async (e) => {
  console.log(e.type);
};

channel.onerror = async (e) => {
  console.log(e.type, e.target);
};

channel.onmessage = async (e) => {
  // Do stuff with data
  console.log(e.data);
};

var offer = await local.createOffer({
  voiceActivityDetection: false,
});
local.setLocalDescription(offer);
