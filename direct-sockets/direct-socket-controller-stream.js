var decoder = new TextDecoder();
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
        delay: 2500,
        priority: "user-visible",
      });
      console.log("sdp:", local.localDescription);
      var abortable = new AbortController();
      var { signal } = abortable;
      var sdp = await (await fetch("http://0.0.0.0:44819", {
        method: "post",
        body: new TextEncoder().encode(local.localDescription.sdp),
        signal,
      })).text();
      await local.setRemoteDescription({
        type: "answer",
        sdp,
      });
      console.log("Done signaling SDP");
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
  protocol: "udp",
});

var readableController;
var writableController;

var { resolve, promise: dataChannelStream } = Promise.withResolvers();

channel.onopen = async (e) => {
  console.log(e.type, e.target);

  var readable = new ReadableStream({
    start(_) {
      return readableController = _;
    },
    cancel(reason) {
      console.log(reason);
    },
  });

  var writable = new WritableStream({
    start(_) {
      return writableController = _;
    },
    write(v) {
      console.log(v);
      channel.send(v);
    },
    close() {
      console.log("writable close");
      channel.close();
    },
    abort(reason) {
      console.log(reason);
    },
  });

  readable.pipeTo(
    new WritableStream({
      write(v) {
        console.log(v);
      },
    }),
  ).catch(() => channel.close());

  resolve({
    readable,
    writable,
  });
};

channel.onclose = async (e) => {
  console.log(e.type, e.target);
  await Promise.allSettled([readable.cancel(), writable.close()]).then(() =>
    console.log("streams closed")
  ).catch(console.log);
};

channel.onclosing = async (e) => {
  console.log(e.type);
};

channel.onbufferedamountlow = (e) => {
  console.log(e.type, channel.bufferedAmount);
};

channel.onerror = async (e) => {
  console.log(e.type, e.target);
  await Promise.allSettled([readable.cancel(), writable.close()]).then(() =>
    console.log("streams closed")
  ).catch(console.log);
};

channel.onmessage = (e) => {
  readableController.enqueue(e.data);
};

var offer = await local.createOffer({
  voiceActivityDetection: false,
});

local.setLocalDescription(offer);

var { readable, writable } = await dataChannelStream;

// var writer = writable.getWriter();

await scheduler.postTask(() => {}, {
  delay: 500,
  priority: "background",
});

await new Response("test").body.pipeTo(writable, {
  preventClose: 1,
});