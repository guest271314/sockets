class DirectSockets {
  options;
  opened;
  close;
  closed;
  constructor(options) {
    this.options = options;
    const {
      resolve: transportClosedResolve,
      reject: transportClosedReject,
      promise: transportClosedPromise
    } = Promise.withResolvers();
    const {
      resolve: dataChannelOpenResolve,
      reject: dataChannelOpenReject,
      promise: dataChannelOpenPromise
    } = Promise.withResolvers();
    const {
      resolve: dataChannelCloseResolve,
      reject: dataChannelCloseReject,
      promise: dataChannelClosePromise
    } = Promise.withResolvers();
    let local, channel, readableController, writableController, rejectOpen, rejectClose;
    this.opened = new Promise(async (resolveOpen, _) => {
      rejectOpen = _;
      var decoder = new TextDecoder;
      local = new RTCPeerConnection({
        sdpSemantics: "unified-plan",
        iceServers: []
      });
      for (const rtcPeerConnectionEvent of [
        "signalingstatechange",
        "iceconnectionstatechange",
        "icegatheringstatechange"
      ]) {
        local.addEventListener(rtcPeerConnectionEvent, async (e) => {
          if (e.type === "iceconnectionstatechange" && e.target.sctp.state === "closed") {
            await dataChannelClosePromise;
            this.options.readyState = channel.readyState;
            transportClosedResolve();
          }
        });
      }
      local.onicecandidate = async (e) => {
        if (!e.candidate) {
          try {
            if (globalThis?.openIsolatedWebApp) {
              await openIsolatedWebApp(`?name=TCPSocket`);
            } else {
              if (globalThis?.setTitle) {
                setTitle(`?=TCPSocket`);
              } else {
                document.title = "?=TCPSocket";
              }
            }
            await scheduler.postTask(() => {}, {
              delay: 2000,
              priority: "user-visible"
            });
            const sdp = await (await fetch("http://0.0.0.0:44819", {
              method: "post",
              body: new TextEncoder().encode(local.localDescription.sdp)
            })).text();
            await local.setRemoteDescription({
              type: "answer",
              sdp
            });
          } catch (e2) {
            console.error(e2);
          }
        }
      };
      channel = local.createDataChannel(JSON.stringify({
        address: options.address,
        port: options.port,
        protocol: options.protocol
      }), {
        negotiated: false,
        ordered: true,
        id: 0,
        binaryType: "arraybuffer",
        protocol: options.protocol
      });
      channel.onopen = async (e) => {
        const {
          binaryType,
          label,
          bufferedAmount,
          ordered,
          protocol,
          readyState,
          reliable
        } = e.target;
        Object.assign(this.options, {
          binaryType,
          label,
          bufferedAmount,
          ordered,
          protocol,
          readyState,
          reliable
        });
        const readable2 = new ReadableStream({
          start(_2) {
            return readableController = _2;
          },
          cancel(reason) {
            console.log(reason);
          }
        });
        const writable2 = new WritableStream({
          start(_2) {
            return writableController = _2;
          },
          write(v) {
            if (channel.readyState === "open") {
              channel.send(v);
            }
          },
          close() {
            channel.close();
            readableController.close();
          },
          abort(reason) {
            console.log(reason);
          }
        });
        dataChannelOpenResolve({
          readable: readable2,
          writable: writable2
        });
      };
      channel.onclose = async (e) => {
        console.log(local);
        this.options.readyState = e.target.readyState;
        if (local.connectionState === "closed" || local?.sctp?.state === "closed") {
          dataChannelCloseReject();
        } else {
          if (local.sctp.state === "connected") {
            dataChannelCloseResolve();
          }
        }
      };
      channel.onclosing = async (e) => {
        console.log(e.type);
      };
      channel.onerror = async (e) => {
        console.log(e.type, e.target);
        await Promise.allSettled([readable.closed, writable.closed])
          .then((args) => console.log(readable.locked, writable.locked)).catch(console.log);
      };
      channel.onmessage = (e) => {
        readableController.enqueue(e.data);
      };
      const offer = await local.createOffer({
        voiceActivityDetection: false,
        offerToReceiveAudio: false,
        offerToReceiveVideo: false,
        iceRestart: false
      });
      await local.setLocalDescription(offer);
      const { readable, writable } = await dataChannelOpenPromise;
      await scheduler.postTask(() => {}, {
        delay: 1000,
        priority: "background"
      });
      this.options.maxMessageSize = options.protocol === "udp" ? 65507 : local.sctp.maxMessageSize;
      this.bufferedAmountLow = async () => await new Promise((resolve) => {
        channel.addEventListener("bufferedamountlow", resolve, {
          once: true
        });
      });
      resolveOpen({ readable, writable });
    }).catch((e) => {
      throw e;
    });
    this.closed = Promise.allSettled([
      new Promise(async (r, _) => {
        rejectClose = _;
        r(transportClosedPromise);
      }),
      dataChannelClosePromise
    ]).catch((e) => {
      throw e;
    });
    this.close = () => {
      try {
        transportClosedReject();
        rejectOpen();
        rejectClose();
        channel?.close();
        local?.close();
      } catch (e) {
        console.log(e);
      } finally {
        this.options.readyState = channel.readyState;
      }
    };
  }
}
