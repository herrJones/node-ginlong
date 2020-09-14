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
//const { time } = require('console');

class GinlongSrv extends EventEmitter {
  constructor () {
    super();

    this._settings = {
      port: 9999,
      //db_path : __dirname + '/ginlong.json',
      db_path : __dirname + '/ginlong.db3',
      purgeLog: {
        onSeen: true,
        after: '2w'
      },
      purgeRecv:  {
        onSeen: true,
        after: '72h'
      }
    };

    this._db = null;
    this._nextCleanup = 0;
    this._bridge = new ginlongBridge({ port : this._settings.port });

    this._bridge.on('srv_listening', () => {
      console.log(' -> server is listening for data <-');
    });
    this._bridge.on('srv_connected', (client) => {
      console.log(' -> connection from ' + client) + ' <-';
    });
    this._bridge.on('srv_error', (err) => {
      console.log(' ** server error detected : ' + err);
    });

    this._bridge.on('sock_data', (data, port) => {
      
      const insStmt = 'INSERT INTO received (port, time, data) VALUES (?,?,?)';

      this._db.run(insStmt, [port, getUnixTime(), JSON.stringify(data)], (err) => {
        if (err) {
          console.log('    on data: insert ok');
        }
      });
      
      

    });
    this._bridge.on('sock_error', (err) => {
      console.log(' ** socket error detected : ' + err);
    });
    this._bridge.on('sock_closed', (port) => {
      console.log('    --> start processing items for port ' + port);
      const SQL = 'select * from received where port = ' + port;

      this._db.all(SQL, (err, rows) => {
        if (err) {
          throw err;
        }
        
        rows.forEach((row) => {
          try {
            this._processReceived(row);
          }
          catch (exc) {
            console.error('onClose(%s) processing error : %s', port, exc);
          }

        });
      });
      
      console.log('    <-- processing ended');

    });

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
                      temp    REAL DEFAULT 0.0,
                      vpv1    REAL DEFAULT 0.0,
                      vpv2    REAL DEFAULT 0.0,
                      ipv1    REAL DEFAULT 0.0,
                      ipv2    REAL DEFAULT 0.0,
                      iac1    REAL DEFAULT 0.0,
                      iac2    REAL DEFAULT 0.0,
                      iac3    REAL DEFAULT 0.0,
                      vac1    REAL DEFAULT 0.0,
                      vac2    REAL DEFAULT 0.0,
                      vac3    REAL DEFAULT 0.0,
                      fac     REAL DEFAULT 0.0,
                      pac     REAL DEFAULT 0.0,
                      e_today REAL,
                      e_total INTEGER,
                      e_cur   REAL,
                      e_prev  INTEGER
                    )`);
      this._db.run(`CREATE INDEX IF NOT EXISTS idx_logs_time
                        ON logs(time)`);

    });

    this._bridge.startServer();

    // wait 5s -> db initialization should be done by then
    this._nextCleanup = setTimeout(this._cleanupData.bind(this), 2.5 * 1000);
    this._nextStats = setTimeout(this._calculateStats.bind(this), 90 * 1000);
   
  }
  destroy() {
    this._bridge.stopServer();

    this._db.run('VACUUM');
    this._db.close();

    clearTimeout(this._nextCleanup);
    clearTimeout(this._nextStats);
  }

}

module.exports = GinlongSrv;

/*
 * create timestamp for logging on screen
 */
const getTimestamp = () => {
  const current_datetime = new Date();
              
  return current_datetime.getFullYear() + '-' + (current_datetime.getMonth() + 1) + '-' + current_datetime.getDate() + ' ' 
                             + current_datetime.getHours() + ':' + current_datetime.getMinutes() + ':' + current_datetime.getSeconds();
};

/*
 * create timestamp for logging in the database
 */
const getUnixTime = () => {               
  return Math.round((new Date()).getTime() / 1000);
};

/*
 *
 */
GinlongSrv.prototype._processReceived = function(element, cleanup = false) {
  let protoData = null;
  let protocol = 'none';
  //let result = 0;

  const bufData = Buffer.from(JSON.parse(element.data));
  try {
    if ((bufData[0] == 0x68) && (bufData[Buffer(bufData).length - 1] == 0x16)) {
      protoData = after.analyze_Solarman_1(bufData);
      console.log('  Solarman-1 detected -> len : ' + bufData.length + ' (' + parseInt(bufData[1]) + ')');
      //console.log('  --> ' + bufData.toString('hex'));
      protocol = 'SOL_1';
    } else if ((bufData[0] == 0xa5) && (bufData[bufData.length - 1] == 0x15)) {
      protoData = after.analyze_Solarman_Ethernet(bufData);
      console.log('  Solarman-Ethernet detected -> len : ' + bufData.length + '(' + parseInt(bufData[1]) + ')');
      console.log('  --> ' + bufData.toString('hex'));
      protocol = 'SOL_E';
    } else {
      //const dt = new Date();
      console.warn('  unknown protocol (' + getTimestamp() + ') -> len : ' + bufData.length + '(' + parseInt(bufData[1]) + ')');
      console.log('  --> ' + bufData.toString('hex'));
      protocol = 'UNKNOWN';
    }
  
    if (protoData != null) {
      this._storeLog(element.time, protoData, cleanup);
    }
    this._updateReceived(element.port, element.time, protocol);
  } catch (error) {
    console.error('process received error ' + error);
  }

};

/*
 *
 */
GinlongSrv.prototype._updateReceived = function(port, unixtime, protocol) {
  const updStmt = 'UPDATE received SET seen = 1, proto = ? WHERE port = ? AND time = ?';
  this._db.run(updStmt, [protocol, port, unixtime]);
};

/*
 * store the converted logs in the local database
 */
GinlongSrv.prototype._storeLog = async function(unixtime, data) {

  const insStmt =
      `INSERT INTO logs (serial, time, seen, temp, 
                         vpv1, vpv2,
                         ipv1, ipv2, 
                         iac1, iac2, iac3,
                         vac1, vac2, vac3,
                         fac, pac,
                         e_today, e_total,
                         e_cur, e_prev) 
                 VALUES (?,?,0,?,
                         ?,?,
                         ?,?,
                         ?,?,?,
                         ?,?,?,
                         ?,?,
                         ?,?,
                         ?,?)`;

  try {

    await this.getStats()
      .then((stats) => {
        // no energy  possible if no ac power detected
        if (data.payload.p_ac.toFixed(1) == 0) {
          console.log('stats - no power - ' + JSON.stringify(data.payload));
          data.payload.e_tod = 0;
        }
  
        // avoid spikes at beginning of the day with 'yesterdays' e-today value 
        if ((stats.e_today == 0) && (data.payload.e_tod.toFixed(1) > 0.3)) {
          console.log('stats - no energy - ' + JSON.stringify(data.payload));
          data.payload.e_tod = 0;
        }


        const stmt = this._db.prepare(insStmt);
        stmt.run( 
          [data.payload.serial, unixtime, data.payload.temp.toFixed(1),
           data.payload.v_pv[0].toFixed(1), data.payload.v_pv[1].toFixed(1),
           data.payload.i_pv[0].toFixed(1), data.payload.i_pv[1].toFixed(1),
           data.payload.i_ac[0].toFixed(1), data.payload.i_ac[1].toFixed(1), data.payload.i_ac[2].toFixed(1),
           data.payload.v_ac[0].toFixed(1), data.payload.v_ac[1].toFixed(1), data.payload.v_ac[2].toFixed(1),
           data.payload.f_ac.toFixed(2), data.payload.p_ac.toFixed(1),
           data.payload.e_tod.toFixed(1), data.payload.e_tot,
           data.payload.e_cur.toFixed(3), data.payload.e_prev], (err) => {
            if (err) {
              console.log('error inserting log: ' + err.message);
              throw new Error(err.message); 
            }
          });
        stmt.finalize();
      })
      .catch((err) => {
        console.error('_storelog error: ' + JSON.stringify(err));
        throw new Error('storeLog getstats error' + JSON.stringify(err));

      });
    

  }
  catch (exc) {
    console.error('_storelog : ' + exc + ' - ' + JSON.stringify(data));
    throw new Error('_storelog : ' + exc + ' - ' + JSON.stringify(data));
  }

  //return result;
};

/*
 * calculate a time difference for a given time + difference -> unix time
 */
GinlongSrv.prototype._calcDateDiff = function(curTime, diff) {
  // calculate 1 hour in unix time format
  let time = (60 * 60); 

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
  this._nextCleanup = setTimeout(this._cleanupData.bind(this), 15 * 60 * 1000);   // every 15 minutes

  console.warn(' * cleanup started');

  // 'emergency-process' reception data
  // --> data which has not been processed for some reason
  const unixTime = getUnixTime();

  this._db.serialize(() => {
    const SQL = 'SELECT * FROM received WHERE time BETWEEN ? AND ? AND seen = 0 ORDER BY time LIMIT 1000';
    this._db.all(SQL, [unixTime - (4*60*60), unixTime - (15*60)], (err, rows) => {   // look back 4 hours
      if (err) {
        console.error('   cleanup process error: ' + err.message);
      }
      this._db.serialize(() => {
        console.log('   start processing data');
        this._db.run('BEGIN TRANSACTION');
        rows.forEach((row) => {
          this._processReceived(row, true);
  
          //this._db.run('UPDATE received set seen = ? where time = ? and port = ?', [elementSeen, row.time, row.port]);
        });
        this._db.run('COMMIT');
        console.log('   finished processing data');
      });
      

    });

    this._db.run('BEGIN TRANSACTION');
    // cleanup reception data
    let diffTime = this._calcDateDiff(unixTime, this.settings.purgeRecv.after);
    console.log('purge recv = now: ' + unixTime + ' - diff: ' + diffTime);
    this._db.run('DELETE FROM received WHERE seen > 0 AND time < ?', [diffTime]);
    this._db.run('DELETE FROM received WHERE seen = 0 AND time < ?', [diffTime - (10*24*60*60)]);   // 10 days before

    // cleanup log data
    diffTime = this._calcDateDiff(unixTime, this.settings.purgeLog.after);
    console.log('purge logs = now: ' + unixTime + ' - diff: ' + diffTime);
    this._db.run('DELETE FROM logs WHERE seen > 0 AND time < ?', [diffTime]);
    this._db.run('DELETE FROM logs WHERE seen = 0 AND time < ?', [diffTime - (10*24*60*60)]);   // 10 days before

    this._db.run('COMMIT');
  });
  
  console.warn(' * cleanup completed');
  
} ;

GinlongSrv.prototype._calculateStats = function() {
  this._nextStats = setTimeout(this._calculateStats.bind(this), 15 * 60 * 1000);   // every 15 minutes

  const statSql = 
    `SELECT STRFTIME("%s", DATETIME("now", "start of day")) AS time_sod, STRFTIME("%s", "now") AS time_now,
            COALESCE(MAX(time), STRFTIME("%s", "now")) AS timestamp, 
            COALESCE(serial, "no_serial") AS serial, 
            COALESCE(e_today, 0) AS e_today, COALESCE(e_total, 0) AS e_total, COALESCE(e_prev, 0) AS e_prev 
       FROM logs`;
  this._db.get(statSql, (err, row) => {

    if (err) {
      console.error('error calculating stats : ' + err.message);
      return;
    }

    const insStmt = 'INSERT INTO logs (seen, time, serial, e_cur, e_today, e_total, e_prev) VALUES (0, ?, ?, ?, ?, ?, ?)';
    if (row.timestamp < row.time_sod) {
      this._db.run(insStmt, [row.time_sod - 60, row.serial, row.e_cur, row.e_today, row.e_total, row.e_prev], (err) => {
        if (err) {
          console.error('calcStats: update before error: ' + err.message);
        }
      });
      this._db.run(insStmt, [row.time_sod + 60, row.serial, 0, 0, row.e_total, row.e_prev], (err) => {
        if (err) {
          console.error('calcStats: update after error: ' + err.message);
        }
      });
    } else if (row.time_now > row.timestamp + 3600) {
      this._db.run(insStmt, [row.time_now , row.serial, row.e_cur, row.e_today, row.e_total, row.e_prev], (err) => {
        if (err) {
          console.error('calcStats: insert error: ' + err.message);
        }
      });
    }
    

  });
};

/*
 * return current solar panel stats
 */
GinlongSrv.prototype.getStats = function() {
  const statSql = 
    `SELECT STRFTIME("%s", "now") as timestamp, count(1) as tmp,
            COALESCE(serial, "no_serial") as serial, 
            COALESCE(e_today, -1) as e_today, COALESCE(e_total, -1) as e_total 
       FROM logs`;

  return new Promise((resolve, reject) => {
    //if (cleanup) {
    //  console.log('getstats - cleanup');
    //  resolve('{no data}');
    //}

    this._db.get(statSql, (err, row) => {
    
      if (err) {
        console.error('getStats: ' + JSON.stringify(err));
        reject('getstats error: ' + JSON.stringify(err));
      }
  
      const result = {
        'time'    : row.timestamp,
        'serial'  : row.serial,
        'e_today' : row.e_today,
        'e_total' : row.e_total 
      };
      console.log('stats = ' + JSON.stringify(result));
      resolve(result);
  
    });
  });

};

