const USER_AGENT = "Built with Bun/1.2.18";
const encoder = new TextEncoder();
const decoder = new TextDecoder();
{
  const udpSocket = new UDPSocket({
    remoteAddress: "52.43.121.77",
    remotePort: 10001,
  });
  console.log(`Opening with ${udpSocket.constructor.name}`);
  const {
    readable,
    writable,
    remoteAddress,
    remotePort,
    localAddress,
    localPort,
  } = await udpSocket.opened;
  console.log({
    remoteAddress,
    remotePort,
    localAddress,
    localPort,
  });
  const reader = readable.getReader();
  const promise = reader.read().then(function read({
    value,
    done,
  } = {
    value: {
      data: void 0,
    },
    done: false,
  }) {
    if (done) return reader.closed.then(() => "Done streaming");
    console.log(decoder.decode(value.data));
    return reader.read().then(read);
  }).catch((e) => e.message);

  const writer = writable.getWriter();
  await writer.write({
    data: encoder.encode(`So we need people to have weird new
ideas ... we need more ideas to break it
and make it better ...

Use it. Break it. File bugs. Request features.

- Soledad Penadés, Real time front-end alchemy, or: capturing, playing,
  altering and encoding video and audio streams, without
  servers or plugins!`),
  });
  await writer.ready;
  await scheduler.postTask(() => {}, { delay: 1000 });
  await Promise.allSettled([
    writer.close(),
    writer.closed,
    reader.cancel(),
    reader.closed,
  ]);
  await promise
    .then((p) => {
      console.log(p);
    }).catch(console.warn);
}

{
  const tcpSocket = new TCPSocket("52.43.121.77", 9001);
  console.log(`Opening ${tcpSocket.constructor.name}`);
  const {
    readable,
    writable,
    remoteAddress,
    remotePort,
    localAddress,
    localPort,
  } = await socket.opened;
  console.log({
    remoteAddress,
    remotePort,
    localAddress,
    localPort,
  });
  const reader = readable.getReader();
  const promise = reader.read().then(function read({
    value,
    done,
  } = {
    value: {
      data: void 0,
    },
    done: false,
  }) {
    if (done) return reader.closed.then(() => "Done streaming");
    console.log(decoder.decode(value?.data || value));
    return reader.read().then(read);
  }).catch((e) => e.message);

  await new Response(`
1. If a (logical or axiomatic formal) system is consistent, it cannot be complete.
2. The consistency of axioms cannot be proved within their own system.

- Kurt Gödel, Incompleteness Theorem, On Formally Undecidable Propositions 
  of Principia Mathematica and Related Systems
`).body.pipeTo(writable, {
    preventClose: 1,
  });
  await scheduler.postTask(() => {}, { delay: 1000 });
  await Promise.allSettled([writable.closed, reader.cancel(), reader.closed]);
  promise
    .then((p) => {
      console.log(p);
    }).catch(console.warn);
}
