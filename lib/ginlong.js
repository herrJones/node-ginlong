'use strict';

//const debug = require('debug')('ginlong module');
const EventEmitter = require('events');
//const net = require('net');
//const loki = require('lokijs');
const sqlite3 = require('sqlite3').verbose();
//const events = require('events');
//const async = require('async');

const ginlongBridge = require('./bridge');
const after = require('./analisys');
const { time } = require('console');

class GinlongSrv extends EventEmitter {
  constructor () {
    super();

    this._settings = {
      port: 9999,
      //db_path : __dirname + '/ginlong.json',
      db_path : __dirname + '/ginlong.db3',
      purgeRaw: {
        onSeen: true,
        after: '2d'
      },
      purgeLog: {
        onSeen: true,
        after: '2w'
      },
      purgeRecv:  {
        onSeen: true,
        after: '12h'
      }
    };

    this._db = null;
    this._nextCleanup = 0;
    this._bridge = new ginlongBridge({ port : this._settings.port });

    this._bridge.on('srv_listening', () => {
      console.log(' -> server is listening for data <-');
    });
    this._bridge.on('srv_connected', (client) => {
      console.log(' -> connection from ' + client);
    });
    this._bridge.on('srv_error', (err) => {
      console.log(' ** server error detected : ' + err);
    });

    this._bridge.on('sock_data', (data, port) => {
      //const recvData = this._db.getCollection('received');
      const unixTime = getTimestamp();

      this._db.run('INSERT INTO received (port, time, data) VALUES (?,?,?)', [port, unixTime, data]);
      //recvData.insertOne({
      //  port: port,
      //  time: unixTime,
      //  data: data,
      //  seen: 0
      //});

    });
    this._bridge.on('sock_error', (err) => {
      console.log(' ** socket error detected : ' + err);
    });
    this._bridge.on('sock_closed', (port) => {
      //const recvData = this._db.getCollection('received');
      //const binData = recvData.find({ 'port' : { '$eq' : port }});

      console.log(' --> start processing');
      const SQL = 'select * from received where port = ' + port;

      this._db.all(SQL, (err, rows) => {
        if (err) {
          throw err;
        }
        
        rows.forEach((row) => {
          let elementSeen = 0;
          console.log('on close : ' + JSON.stringify(row));
          try {
            elementSeen = this._processData(row);
          }
          catch (exc) {
            console.error('onClose(%s) processing error : %s', port, exc);
          }

          this._db.run('UPDATE received set seen = ? where time = ? and port = ?', [elementSeen, row.time, row.port]);

        });
      });
      //binData.forEach((element) => {
      //  let elementSeen = 0;
      //  console.log(JSON.stringify(element));
      //  try {
      //    elementSeen = this._processData(element);
      //  }
      //  catch (exc) {
      //    console.error('onClose(%s) processing error : %s', port, exc);
      //  }
      //  element.seen = elementSeen;
      //});
  
      //recvData.update(binData);
      console.log(' <-- processing ended');

    });
    /*
    this._server = net.createServer({ allowHalfOpen: true, pauseOnConnect: false}, (sock) => {
      let remoteAddress = sock.remoteAddress + ':' + sock.remotePort;
      let recvData = this._db.getCollection('received');

      sock.setTimeout(1000 * 90);     // timeout = 90s
     
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
            data: data,
            seen: 0
          })
        }
        catch (exc) {
          console.error('sock.onData(%s)(%s)(error) : %s', sock.remotePort, time.toISOString(),exc);

          recvData.insertOne({
            port: sock.remotePort,
            time: unixTime,
            data: null,
            seen: 3
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
          let elementSeen = 0
          console.log(JSON.stringify(element));
          try {
            elementSeen = this._processData(element);
          }
          catch (exc) {
            console.error('onClose(%s) processing error : %s', sock.remotePort, exc);
          }
          element.seen = elementSeen;
          callback();
        });
        recvData.update(binData);
        //recvData.findAndRemove({ 'port' : { '$eq' : sock.remotePort }});

        //this._db.saveDatabase();
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
    */
    /*
    this._server.on('error', (e) => {
      var dt = new Date();
      console.log('error detected on server connection (%s) : %s', dt.toUTCString(), JSON.stringify(e));
      
      setTimeout(() => {
        this._server.close();
        this._server.listen(this._settings.port);
      }, 1000);
    });
    */
    /*
    this._server.on('close', () => {
      this._db.saveDatabase();
    });
    */

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

    this._db = new sqlite3.Database(this._settings.db_path, (err) => {
      if (err) {
        return console.error(err.message);
      }
    });

    this._db.serialize(() => {

      this._db.run(`CREATE TABLE IF NOT EXISTS received (
                      seen    INTEGER DEFAULT 0,
                      port    INTEGER NOT NULL,
                      time    INTEGER NOT NULL,
                      proto   TEXT DEFAULT '',
                      data    BLOB)`);
      this._db.run(`CREATE INDEX IF NOT EXISTS idx_recv_time_seen
                        ON received(time, seen)`);
      this._db.run(`CREATE INDEX IF NOT EXISTS idx_recv_port
                        ON received(port)`);

      this._db.run(`CREATE TABLE IF NOT EXISTS logs (
                      serial  TEXT NOT NULL,
                      time    INTEGER NOT NULL,
                      seen    INTEGER NOT NULL,
                      temp    REAL,
                      vpv1    REAL,
                      vpv2    REAL,
                      ipv1    REAL,
                      ipv2    REAL,
                      iac1    REAL,
                      iac2    REAL,
                      iac3    REAL,
                      vac1    REAL,
                      vac2    REAL,
                      vac3    REAL,
                      fac     REAL,
                      pac     REAL,
                      e_today REAL,
                      e_total REAL)`);
      this._db.run(`CREATE INDEX IF NOT EXISTS idx_logs_time_inv
                        ON logs(time, inverter)`);

    });

    this._bridge.startServer();

    // wait 5s -> db initialization should be done by then
    this._nextCleanup = setTimeout(this._cleanupData.bind(this), 5*1000);
   
  }
  destroy() {
    this._bridge.stopServer();

    this._db.run('VACUUM');
    this._db.close();

    clearTimeout(this._nextCleanup);
  }

}

module.exports = GinlongSrv;

const getTimestamp = () => {
  const current_datetime = new Date();
              
  return current_datetime.getFullYear() + '-' + (current_datetime.getMonth() + 1) + '-' + current_datetime.getDate() + ' ' 
                             + current_datetime.getHours() + ':' + current_datetime.getMinutes() + ':' + current_datetime.getSeconds();
};

const getUnixTime = () => {               
  return Math.round((new Date()).getTime() / 1000);
};

/*
 *
 */
GinlongSrv.prototype._processData = function(element) {
  let protoData = null;
  let protocol = 'none';
  let result = 0;

  const bufData = Buffer.from(JSON.parse(element.data));

  if ((bufData[0] == 0x68) && (bufData[Buffer(bufData).length - 1] == 0x16)) {
    protoData = after.analyze_Solarman_1(bufData);
    console.log('  Solarman-1 detected -> len : ' + bufData.length + ' (' + parseInt(bufData[1]) + ')');
    //console.log('  --> ' + bufData.toString('hex'));
    protocol = 'SOL_1';
  } else if ((bufData[0] == 0xa5) && (bufData[bufData.length - 1] == 0x15)) {
    protoData = after.analyze_Solarman_Ethernet(bufData);
    //console.log('  Solarman-Ethernet detected -> len : ' + bufData.length + '(' + parseInt(bufData[1]) + ')');
    //console.log('  --> ' + bufData.toString('hex'));
    protocol = 'SOL_E';
  } else {
    const dt = new Date();
    console.warn('  unknown protocol (' + getTimestamp() + ') -> len : ' + bufData.length + '(' + parseInt(bufData[1]) + ')');
    console.log('  --> ' + bufData.toString('hex'));
    protocol = 'UNKNOWN';
  }

  this._updateReceived(element.port, element.time, protocol);
  /*
  if (this._storeRawData(protocol, element)) {
    result = 1;
  }
  */

  if (protoData != null) {
    //const invID = this._storeInverter(protoData);

    if (this._storeLog(element.time, protoData)) {
      result += 2;
    }
  }

  return result;
};

/*
 * store received data in local database
 */
/*
GinlongSrv.prototype._storeRawData = function(proto, element) {

};
*/

GinlongSrv.prototype._updateReceived = function(port, unixtime, protocol) {
  const updStmt = 'UPDATE received SET seen = 1, proto = ? WHERE port = ? AND time = ?';
  this._db.run(updStmt, [protocol, port, unixtime]);
};

/*
 * check if the current inverter exists in the local database
 */
/*
GinlongSrv.prototype._storeInverter = function(data) {
  //const inverters = this._db.getCollection('inverters');
  //const curInfo = inverters.find({ 'serial' : { '$eq' : data.payload.serial }});

};
*/

/*
 * store the converted logs in the local database
 */
GinlongSrv.prototype._storeLog = function(unixtime, data) {
  //const logs = this._db.getCollection('logs');
  let result = false;
  
  try {
    //const curLog = {
    //  inverter: data.payload.serial, time: unixtime, seen: 0,
    //  temp: data.payload.temp.toFixed(1), 
    //  vpv1: data.payload.v_pv[0].toFixed(1), vpv2: data.payload.v_pv[1].toFixed(1),
    //  ipv1: data.payload.i_pv[0].toFixed(1) ,ipv2: data.payload.i_pv[1].toFixed(1),
    //  iac1: data.payload.i_ac[0].toFixed(1) ,iac2: data.payload.i_ac[1].toFixed(1), iac3: data.payload.i_ac[2].toFixed(1),
    //  vac1: data.payload.v_ac[0].toFixed(1) ,vac2: data.payload.v_ac[1].toFixed(1), vac3: data.payload.v_ac[2].toFixed(1),
    //  fac: data.payload.f_ac.toFixed(2) ,pac: data.payload.p_ac.toFixed(1),
    //  e_today: data.payload.e_tod.toFixed(1) ,e_total: data.payload.e_tot ,e_cur: data.payload.e_cur.toFixed(3),
    //  e_prev: data.payload.e_prev ,p_status: data.payload.p_status
    //};

    this._db.run(`INSERT INTO logs (inverter, time, seen, temp, 
                        vpv1, vpv2,
                        ipv1, ipv2, 
                        iac1, iac2, iac3,
                        vac1, vac2, vac3,
                        fac, pac,
                        e_today, e_total) 
                  VALUES (?,?,?,?,
                        ?,?,
                        ?,?,
                        ?,?,?,
                        ?,?,?,
                        ?,?,
                        ?,?)`, 
     [data.payload.serial, unixtime, 0, data.payload.temp,
      data.payload.vpv1, data.payload.vpv2,
      data.payload.ipv1,data.payload.ipv2,
      data.payload.iac1,data.payload.iac2,data.payload.iac3,
      data.payload.vac1,data.payload.vac2,data.payload.vac3,
      data.payload.fac,data.payload.pac,
      data.payload.e_today,data.payload.e_total], (err) => {
      if (err) {
        console.log('error inserting log: ' + err.message);
      }
    });

    // only insert when 'e_cur' > 0, otherwise false readings at beginning of the day
    //if (data.payload.p_ac.toFixed(1) == 0) {
    //  curLog.e_today = 0;
    //}
    //logs.insertOne(curLog);
    result = true;
  }
  catch (exc) {
    console.error('_storelog : ' + exc + ' - ' + JSON.stringify(data));
  }

  return result;
};

/*
 * calculate a time difference for a given time + difference -> unix time
 */
GinlongSrv.prototype._calcDateDiff = function(curTime, diff) {
  // calculate 1 day in unix time format
  let time = (24 * 60 * 60); // * 1000;

  if (diff.endsWith('h')) {
    diff = diff.replace('h', '');

    time = time * diff;
  } else if (diff.endsWith('d')) {
    diff = diff.replace('d', '');

    time = time * diff * 24;
  } else if (diff.endsWith('w')) {
    diff = diff.replace('w', '');

    time = time * diff * 24 * 7;
  }
  
  return curTime - time;
};

/*
 * automatic cleanup of data
 */
GinlongSrv.prototype._cleanupData = function() {
  this._nextCleanup = setTimeout(this._cleanupData.bind(this), 1000*60*10);

  console.warn(' * cleanup started');

  // 'emergency-process' reception data
  // --> data which has not been processed for some reason
  const unixTime = getUnixTime();
  //let diffTime = this._calcDateDiff(curDate, this.settings.purgeRecv.after);
  //let lokiData = this._db.getCollection('received');
  //if (lokiData != null) {
  //  const unprocessed = lokiData.chain()
  //    .find({ 'seen' : { '$lt' : 1 } })
  //    .find({ 'time' : { '$lt' : (curDate - (1000*60*30)) }})
  //    .data();
  //  
  //  unprocessed.forEach(element => {
  //    element.seen = this._processData(element);
  //  });
  //  lokiData.update(unprocessed);
  //  console.log('   finished processing');
  //} else {
  //  console.warn('   no received database found');
  //}

  this._db.serialize(() => {
    const SQL = 'select * from received where time < ? and seen = 0';
    this._db.all(SQL, [unixTime - (1000*60*30)], (err, rows) => {
      if (err) {
        console.error('cleanup process error: ' + err.message);
      }
      this._db.serialize(() => {
        this._db.run('BEGIN TRANSACTION');
        rows.forEach((row) => {
          this._processData(row);
  
          //this._db.run('UPDATE received set seen = ? where time = ? and port = ?', [elementSeen, row.time, row.port]);
        });
        this._db.run('COMMIT');
      });
      

    });

    this._db.run('BEGIN TRANSACTION');
    // cleanup reception data
    let diffTime = this._calcDateDiff(unixTime, this.settings.purgeRecv.after);
    console.log('purge recv = now: ' + unixTime + ' - diff: ' + diffTime);
    this._db.run('DELETE FROM received WHERE seen > 0 AND time < ?', [diffTime]);

    // cleanup raw data
    //diffTime = this._calcDateDiff(unixTime, this.settings.purgeRaw.after);
    //console.log('purge raw  = now: ' + unixTime + ' - diff: ' + diffTime);
    //this._db.run('DELETE FROM rawdata WHERE seen > 0 AND time < ?', [diffTime]);

    // cleanup log data
    diffTime = this._calcDateDiff(unixTime, this.settings.purgeLog.after);
    console.log('purge logs = now: ' + unixTime + ' - diff: ' + diffTime);
    this._db.run('DELETE FROM logs WHERE seen > 0 AND time < ?', [diffTime]);

    this._db.run('COMMIT');
  });
  

  
  //lokiData = this._db.getCollection('received');
  //lokiData.findAndRemove({ 'time' : { '$lt' : diffTime}});
  //let delData = lokiData.chain()
  //  .find({ 'time' : { '$lt' : diffTime}})
  //  .remove()
  //  .data();
  //console.log('lokiData = ' + lokiData.length + ' - delData = ' + delData.length);
  //lokiData.remove(delData);

  
  
  //lokiData = this._db.getCollection('raw');
  //lokiData.findAndRemove({ 'time' : { '$lt' : diffTime}});
  //lokiData.chain()
  //  .find({ 'time' : { '$lt' : diffTime}})
  //  .remove();

  
  
  //lokiData = this._db.getCollection('logs');

  //lokiData.findAndRemove({ 'time' : { '$lt' : diffTime}});
  //lokiData.chain()
  //  .find({ 'time' : { '$lt' : diffTime}})
  //  .remove();

  //this._db.saveDatabase((err) => {
  //  if (err) {
  //    console.error('   !! database save error');
  //  }
  console.warn(' * cleanup completed');
  //});
  
  
} ;

/*
 * return current solar panel stats
 */
GinlongSrv.prototype.getStats = function() {
  let result = '';
  let insertLog = false;
  //const inverters = this._db.getCollection('inverters');
  //const logs = this._db.getCollection('logs');
  const curDate = new Date();
  const curTime = getUnixTime();
/*
  inverters.data.forEach(inverter => {
    const curLog = logs.chain()
      .find({ 'inverter' : { '$eq' : inverter.id}})
      .simplesort('time', true)
      .limit(3)
      .data();

    let logDate = new Date(curLog[0].time * 1000);

    result = {
      'e_total' : curLog[0].e_total,
      'e_today' : 0,
      'serial'  : inverter.serial,
      'time'    : curUnixTime
    };

    if ((logDate.getDate() === curDate.getDate()) &&
        (logDate.getMonth() === curDate.getMonth())) {
      result.e_today = curLog[0].e_today;
      
      //if ((curLog[0].pac > 0) && 
      //    (curUnixTime - curLog[0].time > 900)) {
      //  insertLog = true;
      //}
    } else {
      insertLog = true;
    }

    if (insertLog) {
      logDate = Math.round(new Date(curDate.getFullYear(), curDate.getMonth(), curDate.getDate()).getTime() / 1000);

      let newLog = {
        inverter: inverter.id, time: logDate - 60, seen: 0,
        temp: 0, 
        vpv1: 0, vpv2: 0,
        ipv1: 0 ,ipv2: 0,
        iac1: 0 ,iac2: 0, iac3: 0,
        vac1: 0 ,vac2: 0, vac3: 0,
        fac:0 ,pac: 0,
        e_today: curLog[0].e_today ,e_total: curLog[0].e_total ,e_cur: 0,
        e_prev: curLog[0].e_prev ,p_status: curLog[0].p_status
      };
      //  logs.insertOne(newLog);

      newLog = {
        inverter: inverter.id, time: logDate + 60, seen: 0,
        temp: 0, 
        vpv1: 0, vpv2: 0,
        ipv1: 0 ,ipv2: 0,
        iac1: 0 ,iac2: 0, iac3: 0,
        vac1: 0 ,vac2: 0, vac3: 0,
        fac:0 ,pac: 0,
        e_today: 0 ,e_total: curLog[0].e_total ,e_cur: 0,
        e_prev: curLog[0].e_prev ,p_status: curLog[0].p_status
      };
      //  logs.insertOne(newLog);

    }
  });
*/

  return result;
};

