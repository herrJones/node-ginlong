'use strict'

const debug = require('debug')('ginlong module');
const EventEmitter = require('events');
const net = require('net');
const loki = require('lokijs');
const parser = require('binary-parser').Parser;
const async = require('async'); 


class GinlongSrv extends EventEmitter {
  constructor () {
    super();

    this._settings = {
      port: 9999,
      db_path : __dirname + '/ginlong.json',
      purgeRaw: {
        onSeen: true,
        after: '2d'
      },
      purgeLog: {
        onSeen: true,
        after: '2d'
      }
    };

    this._db = null;

    this._server = net.createServer({ allowHalfOpen: true, pauseOnConnect: false}, (sock) => {
      let remoteAddress = sock.remoteAddress + ':' + sock.remotePort;
      let recvData = this._db.getCollection('received');

      sock.setTimeout(1000 * 120);     // timeout = 30s
     
      console.log( ' -> new client connected: %s', remoteAddress);

      sock.on('data', (data) => {
        let time = new Date();
        let unixTime = Math.round((new Date()).getTime() / 1000);
        try {
          //let hexTemp = this._parseSolarman_toHexString(data);
          console.log('sock.onData(%s)(%s) : %s' , sock.remotePort, time.toISOString(), data.length);

          recvData.insertOne({
            port: sock.remotePort,
            time: unixTime,
            data: data
          })
        }
        catch (exc) {
          console.error('sock.onData(%s)(%s)(error) : %s', sock.remotePort, time.toISOString(),exc);

          recvData.insertOne({
            port: sock.remotePort,
            time: unixTime,
            data: null
          })

        }
      });
      sock.on('close', (had_error) => {
        console.log( ' <- connection closed %s', remoteAddress);

        if (had_error) {
          console.warn('    there has been an error');
        }

        //trigger parallel processing?
        let binData = recvData.find({ 'port' : { '$eq' : sock.remotePort }});
        async.forEach(binData, (element, callback) => {
          try {
            this._processData(element);
          }
          catch (exc) {
            console.error('onClose(%s) processing error : %s', sock.remotePort, exc);
          }
          callback();
        });
        recvData.findAndRemove({ 'port' : { '$eq' : sock.remotePort }});

        this._db.saveDatabase();
        console.log(' <- processing ended');
      });
      sock.on('error', (err) => {
        var dt = new Date();
  
        console.log('sock.onError(%s)(%s)(error) : %s', sock.remotePort, dt.toISOString(), err.message);
      });
      sock.on('timeout', () => {
        var dt = new Date();
        console.error('sock.onTimeout(%s)(%s)', sock.remotePort, dt.toISOString());
    
        sock.destroy();
      })

    });
    this._server.on('error', (e) => {
      var dt = new Date();
      console.log('error detected on server connection (%s)', dt.toUTCString());
      
      setTimeout(() => {
        this._server.close();
        this._server.listen(this._settings.port);
      }, 1000);
    });

    this._server.on('close', () => {
      this._db.saveDatabase();
    });

    //this._create = create();
  }
  get settings() {
    return this._settings;
  }
  set settings(value) {
    this._settings = value;
  }
  get db() {
    return this._db;
  }

  create() {

    this._db = new loki(this._settings.db_path, {
      autoload: true,
      autoloadCallback : () => {
        var entries = this._db.getCollection("inverters");
        if (entries === null) {
          // list of received data -> should be cleaned up as soon as possible
          this._db.addCollection('received', { indices : ['port']});

          // list of 'raw data', received from the inverter
          this._db.addCollection('raw', { indices : ['time', 'seen']});
      
          // list of invertors 
          this._db.addCollection('inverters');
      
          // log of received data
          this._db.addCollection('logs', { indices : ['time', 'seen']});
      
          // calculated statistics
          this._db.addCollection('stats', { indices : ['date']})
      
        }
      }
    });
  
    this._server.listen(this._settings.port, () => {
      console.log('\nginlong server is listening on ' + this._settings.port + '\r\n');
    });
  
  }
  destroy() {
    this._server.close((err) => {
      if (err === undefined) {
        console.log("\nginlong server closed");
      } else {
        console.error("\nginlong server closed - error detected\n" + err);
      }
      
    });
  }

}

module.exports = GinlongSrv;


/*

*/
GinlongSrv.prototype._processData = function(element) {
  let protoData = null;
  let protocol = 'none'

  if ((element.data[0] == 0x68) && (element.data[data.length - 1] == 0x16)) {
    protoData = this._parseSolarman_1(element.data);
    console.log("  Solarman-1 detected -> len : " + element.data.length + "(" + parseInt(element.data[1]) + ")");
    protocol = 'SOL_1';
  } else if ((element.data[0] == 0xa5) && (element.data[element.data.length - 1] == 0x15)) {
    protoData = this._parseSolarman_Ethernet(element.data);
    console.log("  Solarman-Ethernet detected -> len : " + element.data.length + "(" + parseInt(element.data[1]) + ")");
    protocol = 'SOL_E';
  } else {
    var dt = new Date();
    //log.warn("unknown protocol -> len : " + element.length + "(" + parseInt(element[1]) + ")(" + element.toString('hex') + ")");
    console.warn("  unknown protocol (" + dt.toUTCString()+ ") -> len : " + element.data.length + "(" + parseInt(element.data[1]) + ")(" + element.data.toString('hex') + ")");
    protocol = 'UNKNOWN';
  }
  this._storeRawData(protocol, element);

  if (protoData != null) {
    let invID = this._storeRawData(protoData);

    this._storeLog(invID, element.time, protoData);
  }
}


/*
 * received data parsing
 */
GinlongSrv.prototype._parseSolarman_1 = function(data) {
  let result = {}

  let parseShort_20 = new parser()
    .string('payload', {encoding: 'hex', length: 30});

  let parseLong_79 = new parser()
    .skip(14)
    .string('serial', {encoding: 'ascii', length : 15 })                    // offset = 15 - 30
    .skip(1)
    .uint16le('temp', {formatter: function(field) { return field / 10; }})  // offset = 31
    .array('v_pv', {
      type: 'uint16le',
      length: 2,
      formatter: function(arr) { 
        let newArr = [];
        arr.forEach(function(element) {
          newArr.push(element / 10);
        });
        return newArr; 
      }
    })
    .array('i_pv', {
      type: 'uint16le',
      length: 2,
      formatter: function(arr) { 
        let newArr = [];
        arr.forEach(function(element) {
          newArr.push(element / 10);
        });
        return newArr; 
      }
    })
    .array('i_ac', {
      type: 'uint16le',
      length: 3,
      formatter: function(arr) { 
        let newArr = [];
        arr.forEach(function(element) {
          newArr.push(element / 10);
        });
        return newArr; 
      }
    })
    .array('v_ac', {
      type: 'uint16le',
      length: 3,
      formatter: function(arr) { 
        let newArr = [];
        arr.forEach(function(element) {
          newArr.push(element / 10);
        });
        return newArr; 
      }
    })
    .uint16le('f_ac', {formatter: function(field) { return field / 100; }})
    .uint16le('p_ac', {formatter: function(field) { return field / 10; }})
    .skip(2)
    .uint16le('e_tod',{formatter: function(field) { return field / 100; }})
    .skip(2)
    .uint32le('e_tot',{formatter: function(field) { return field / 10; }})
    .skip(10)
    .uint8('p_status')
    .skip(4)
    .uint16le('e_prev')
    .skip(8)
    .uint16le('p_limit')
    .uint16le('e_cur',{formatter: function(field) { return field / 1000; }});
    //.skip(3)
    //.uint16le('g_pfc');

  let parseUndefined = new parser()
    .string('payload', {encoding: 'hex', length: 30});

  let parseHdr = new parser()
    .skip(1)
    .uint8('pkgType')
    .skip(2)
    .string('rev1', {encoding: 'hex', length:4})
    .string('rev2', {encoding: 'hex', length:4})
    .skip(1)
    .string('header', {encoding: 'hex', length:8})
    .choice('payload', {
      tag: 'pkgType',
      choices: {
        0x20: parseShort_20,
        0x79: parseLong_79
      },
      defaultChoice: parseUndefined
    });

  try {
    result = parseHdr.parse(data);
    if(result.pkgType != 121) {
      result = null;
    }
  }
  catch (err) {
    console.log('ERROR (S_1): ' + err);
    log.error('ERROR (S_1): ' + err);
  }

  return result;
 
}

GinlongSrv.prototype._parseSolarman_Ethernet = function (data) {
  let result = {}

  let parseShort_01 = new parser()
    .uint32le('test1')
    .uint32le('test2')
    .uint8('checksum');

  let parseLong_77 = new parser()
    .skip(28)
    .string('serial', {encoding: 'ascii', length : 15 })                    // offset = 15 - 30
    .skip(1)
    .uint16le('temp', {formatter: function(field) { return field / 10; }})  // offset = 31
    .array('v_pv', {
      type: 'uint16le',
      length: 2,
      formatter: function(arr) { 
        let newArr = [];
        arr.forEach(function(element) {
          newArr.push(element / 10);
        });
        return newArr; 
      }
    })
    .array('i_pv', {
      type: 'uint16le',
      length: 2,
      formatter: function(arr) { 
        let newArr = [];
        arr.forEach(function(element) {
          newArr.push(element / 10);
        });
        return newArr; 
      }
    })
    .array('i_ac', {
      type: 'uint16le',
      length: 3,
      formatter: function(arr) { 
        let newArr = [];
        arr.forEach(function(element) {
          newArr.push(element / 10);
        });
        return newArr; 
      }
    })
    .array('v_ac', {
      type: 'uint16le',
      length: 3,
      formatter: function(arr) { 
        let newArr = [];
        arr.forEach(function(element) {
          newArr.push(element / 10);
        });
        return newArr; 
      }
    })
    .uint16le('f_ac', {formatter: function(field) { return field / 100; }})
    .uint16le('p_ac', {formatter: function(field) { return field / 10; }})
    .skip(2)
    .uint16le('e_tod',{formatter: function(field) { return field / 100; }})
    .skip(2)
    .uint32le('e_tot',{formatter: function(field) { return field / 10; }})
    .skip(10)
    .uint8('p_status')
    .skip(4)
    .uint16le('e_prev')
    .skip(8)
    .uint16le('p_limit')
    .uint16le('e_cur',{formatter: function(field) { return field / 1000; }});
  

let parseUndefined = new parser()
  .string('payload', {encoding: 'hex', length: 30});

let parseHdr = new parser()
  .skip(1)
  .uint8('pkgType')
  .skip(2)
  .choice('payload', {
    tag: 'pkgType',
    choices: {
      0x01: parseShort_01,
      0x77: parseLong_77
    },
    defaultChoice: parseUndefined
  });

  try {
    result = parseHdr.parse(data);
    //console.log(JSON.stringify(lineData));
    if(result.pkgType != 119) {
      result = null;
    }    
  }
  catch (err) {
    console.log('ERROR (S_E): ' + err);
    //log.error('ERROR (S_E): ' + err);
  }

  return result;
}

GinlongSrv.prototype._parseSolarman_checksum = function (byteArray) {
  
  let checksum = 0x00
  for(let i = 1; i < byteArray.length - 2; i++) {
    //checksum ^= byteArray[i];
    checksum = (checksum + byteArray[i]) % 256;
    //checksum %= 256;
  }
    
  return checksum; 
}

GinlongSrv.prototype._parseSolarman_toHexString = function (byteArray) {
  return Array.from(byteArray, function(byte) {
    return ('0' + (byte & 0xFF).toString(16)).slice(-2);
  }).join('')
}

GinlongSrv.prototype._storeRawData = function(proto, element) {
  let rawLogs = this._db.getCollection('raw');

  let curLog = {
    time: element.time, seen: 0,
    proto: proto, 
    data: this._parseSolarman_toHexString(element.data)
  }

  rawLogs.insertOne(curLog);
}

GinlongSrv.prototype._storeInverter = function(data) {
  let inverters = this._db.getCollection('inverters');
  let curInfo = inverters.find({ 'serial' : { '$eq' : data.payload.serial }});

  if (curInfo.length == 0) {
    let curInverter = {
      id: inverters.length + 1,
      serial: data.payload.serial
    }

    inverters.insertOne(curInverter);

    return curInverter;

  } else {
    return curInfo[0];
  }
}

GinlongSrv.prototype._storeLog = function(inverter, unixtime, data) {
  let logs = this._db.getCollection('logs');

  let curLog = {
    inverter: inverter.id, time: unixtime, seen: 0,
    temp: data.payload.temp.toFixed(1), 
    vpv1: data.payload.v_pv[0].toFixed(1), vpv2: data.payload.v_pv[1].toFixed(1),
    ipv1: data.payload.i_pv[0].toFixed(1) ,ipv2: data.payload.i_pv[1].toFixed(1),
    iac1: data.payload.i_ac[0].toFixed(1) ,iac2: data.payload.i_ac[1].toFixed(1), iac3: data.payload.i_ac[2].toFixed(1),
    vac1: data.payload.v_ac[0].toFixed(1) ,vac2: data.payload.v_ac[1].toFixed(1), vac3: data.payload.v_ac[2].toFixed(1),
    fac: data.payload.f_ac.toFixed(2) ,pac: data.payload.p_ac.toFixed(1),
    e_today: data.payload.e_tod.toFixed(1) ,e_total: data.payload.e_tot ,e_cur: data.payload.e_cur.toFixed(3),
    e_prev: data.payload.e_prev ,p_status: data.payload.p_status
  }

  logs.insertOne(curLog);
}

 GinlongSrv.prototype._storeStats = function(inverter, data) {
  let stats = this._db.getCollection('stats');
  let dt = new Date();
  let curDate = dt.getFullYear()
    + '-' + pad2(dt.getMonth()+1)
    + '-' + pad2(dt.getDate());

}


process.on('uncaughtException', (err) => {
  console.log('uncaught exception: ' + err);
})

