class DirectSocket {
  #port;
  #handleMessage;
  #handleDisconnect;
  #readableController;
  #readable = new ReadableStream({
    start: (_) => {
      this.#readableController = _;
    },
  });
  #delay = async (task = () => {}, delay = 50) => {
    return scheduler.postTask(task, { delay });
  };
  #writableController;
  #writable = new WritableStream({
    start: (_) => {
      this.#writableController = _;
    },
    write: async (message) => {
      await this.#delay();
      this.#port.postMessage(message?.data ? message : [...message]);
    },
    close: () => {
      try {
        this.#port.disconnect();
        this.#readableController.close();
      } catch (e) {
        console.log(e);
      }
    },
  });
  #socketParams = 0;
  #opened = Promise.withResolvers();
  #closed = Promise.withResolvers();
  closed;
  opened;
  constructor(socketType, remoteAddress, remotePort) {
    this.opened = this.#opened.promise;
    this.closed = this.#closed.promise;
    this.#handleMessage = (message, port) => {
      if (!(this.#socketParams)) {
        this.#socketParams = 1;
        this.#opened.resolve({
          readable: this.#readable,
          writable: this.#writable,
          ...message,
        });
      } else {
        this.#readableController.enqueue(
          Object.hasOwn(message, "data")
            ? { data: new Uint8Array(Object.values(message.data)) }
            : new Uint8Array([...message]),
        );
      }
      return true;
    };
    this.#handleDisconnect = (port) => {
      if (globalThis.chrome.runtime?.lastError) {
        console.log(globalThis.chrome.runtime.lastError);
      }
      this.#closed.resolve(void 0);
    };
    this.#port = globalThis.chrome.runtime.connect(
      EXTENSION_ID,
      { name: "web" },
    );
    this.#port.onMessage.addListener(this.#handleMessage);
    this.#port.onMessage.addListener(this.#handleDisconnect);
    this.#delay(() => {
      this.#port.postMessage({ socketType, remoteAddress, remotePort });
    }, 100);
  }
  close() {
    this.#port.disconnect();
  }
}

if (!Object.hasOwn(globalThis, "DirectSocket")) {
  Object.assign(globalThis, {
    DirectSocket,
  });
  console.log("DirectSocket declared");
}
