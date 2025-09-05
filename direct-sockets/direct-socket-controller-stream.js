var decoder = new TextDecoder();
var local = new RTCPeerConnection({
  sdpSemantics: "unified-plan",
  iceServers: []
});
["signalingstatechange", 
 "iceconnectionstatechange", 
 "icegatheringstatechange", ]
  .forEach( (e) => local.addEventListener(e, console.log));

local.onicecandidate = async (e) => {
  if (!e.candidate) {
    try {
      if (globalThis?.openIsolatedWebApp) {
        await openIsolatedWebApp(`?name=TCPSocket`);
      } else {
        setTitle(`?=TCPSocket`);
      }
      await scheduler.postTask( () => {}
      , {
        delay: 2500,
        priority: "user-visible",
      });
      console.log("sdp:", local.localDescription.toJSON().sdp);
      var abortable = new AbortController();
      var {signal} = abortable;
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
}
;
var channel = local.createDataChannel("transfer", {
  negotiated: true,
  ordered: true,
  id: 0,
  binaryType: "arraybuffer",
  protocol: "tcp",
});

var readableController;
var writableController;

var {resolve, promise: dataChannelStream} = Promise.withResolvers();

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

  resolve({
    readable,
    writable,
  });
};

channel.onclose = async (e) => {
  console.log(e.type, e.target);
  await Promise.allSettled([readable.cancel(), writable.close()])
    .then( () => console.log("Data channel closed")).catch(console.log);
};

channel.onclosing = async (e) => {
  console.log(e.type);
};

channel.onerror = async (e) => {
  console.log(e.type, e.target);
  await Promise.allSettled([readable.cancel(), writable.abort(e.message)])
    .then( () => console.log("Data channel errored")).catch(console.log);
};

channel.onmessage = (e) => {
  readableController.enqueue(e.data);
};

var offer = await local.createOffer({
  voiceActivityDetection: false,
});

local.setLocalDescription(offer);

var {readable, writable} = await dataChannelStream;

var writer = writable.getWriter();
var reader = readable.getReader();

await scheduler.postTask( () => {}
, {
  delay: 500,
  priority: "background",
});

Promise.allSettled([writable.closed, readable.closed])
  .then( (args, ) => console.log(args)).catch(console.error);

var {maxMessageSize} = local.sctp;

async function stream(input) {
  let len = 0;
  for (let i = 0; i < input.length; i += maxMessageSize) {
    const data = input.subarray(i, i + maxMessageSize);
    const inputLength = data.length;
    await writer.ready;
    await writer.write(data);
    let readLength = 0;
    do {
      var {value, done} = await reader.read();
      len += value.byteLength;
      readLength += value.byteLength;
    } while (readLength < inputLength);
  }
  return len;
}

var binaryResult = await stream(new Uint8Array(1024 ** 2 * 20)).catch( (e) => e);

console.log({
  binaryResult,
});
