'use strict';

//const debug = require('debug');
//const Buffer = require('safe-buffer').Buffer;
//const udp = require('dgram');
const tcp = require('net');
const events = require('events');
//const { emit } = require('process');

const getTimestamp = () => {
  const current_datetime = new Date();
              
  return current_datetime.getFullYear() + '-' + (current_datetime.getMonth() + 1) + '-' + current_datetime.getDate() + ' ' 
                             + current_datetime.getHours() + ':' + current_datetime.getMinutes() + ':' + current_datetime.getSeconds();
};

class GinlongBridge extends events {

  constructor(options) {
    super();

    this.settings = options;
    this.remoteAddress = null;
    this.server = null;

    this.initServer();
  }

  initServer () {
    this.server = new tcp.Server({ allowHalfOpen: true, pauseOnConnect: false});

    this.server.on('connection', (socket) => {
      this.remoteAddress = socket.remoteAddress + ':' + socket.remotePort;

      console.log( ' -> new client connected: %s', this.remoteAddress);
      socket.setTimeout(1000 * 90);

      this.emit('srv_connected', this.remoteAddress);

      socket.on('data', (rxdata) => {
        socket.emit('sock_data', rxdata, socket.remotePort);
      });
      socket.on('error', (err) => {
        console.warn('sock.onError(%s)(%s)(error) : %s', socket.remotePort, getTimestamp(), err.message);
        socket.emit('sock_error', JSON.stringify(err));
        socket.destroy();
      });
      socket.on('timeout', () => {
        socket.close();
      });
      socket.on('close', (had_error) => {
        if (had_error) {
          console.warn('    there has been an error');
        }
        socket.emit('sock_closed', socket.remotePort);
      });
    });

    this.server.on('listening', () => {
      console.log('ginlong server is listening on ' + this.settings.port);
      this.emit('srv_listening');
    });

    this.server.on('error', (err) => {
      
      console.log('error detected on server connection (%s) : %s', getTimestamp(), JSON.stringify(err));

      this.emit('srv_error', JSON.stringify(err));
      setTimeout(() => {
        this._server.close();
        this._server.listen(this._settings.port);
      }, 5000);
    });


  }

  startServer() {
    this.server.listen(this.settings.port);
  }

  stopServer() {
    this.server = this.server.close();
  }
}

module.exports = GinlongBridge;