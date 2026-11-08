const net = require('node:net');

const listen = (server) =>
  new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      server.removeListener('error', reject);
      resolve();
    });
  });

const closeServer = (server) =>
  new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });

const createFakeYeelight = async (onCommand) => {
  const sockets = new Set();
  const commands = [];
  const server = net.createServer((socket) => {
    sockets.add(socket);
    socket.on('close', () => sockets.delete(socket));

    let input = '';
    socket.on('data', async (chunk) => {
      input += chunk.toString('utf8');

      let boundary = input.indexOf('\r\n');
      while (boundary !== -1) {
        const frame = input.slice(0, boundary);
        input = input.slice(boundary + 2);

        if (frame) {
          const command = JSON.parse(frame);
          commands.push(command);
          await onCommand(command, socket, commands);
        }

        boundary = input.indexOf('\r\n');
      }
    });
  });

  await listen(server);
  const address = server.address();

  return {
    commands,
    host: address.address,
    port: address.port,
    async close() {
      for (const socket of sockets) {
        socket.destroy();
      }
      await closeServer(server);
    },
  };
};

const sendMessage = (socket, message) => {
  socket.write(`${JSON.stringify(message)}\r\n`);
};

module.exports = {
  createFakeYeelight,
  sendMessage,
};
