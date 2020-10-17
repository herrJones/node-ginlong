'use strict';

//const debug = require('debug')('ginlong module');
const EventEmitter = require('events');
//const loki = require('lokijs');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
//const events = require('events');

const ginlongBridge = require('./bridge');
const after = require('./analisys');

class GinlongSrv extends EventEmitter {
  constructor () {
    super();

    this._settings = {
      port: 9999,
      db_path : __dirname + '/ginlong.db3',
      purgeLog: {
        onSeen: true,
        after: '4w'
      },
      purgeRecv: {
        onSeen: true,
        after: '5d'
      },
      verbose: true,
      events: false
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
      
      const insStmt = 'INSERT INTO received (port, time, data) VALUES (?, STRFTIME("%s", "now"), ?)';

      this._db.run(insStmt, [port, JSON.stringify(data)], (err) => {
        if (err) {
          console.log('    on data: insert error:' + err);
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
  
  create_database() {
    if (this._db) {
      this._db.close();
    }

    console.log('create database in: ' + path.resolve(this._settings.db_path));
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
                      data    BLOB,
                      json    TEXT DEFAULT '')`);
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
  }

  create() {

    this.create_database();

    this._bridge.startServer();

    // wait 5s -> db initialization should be done by then
    this._nextCleanup = setTimeout(this._cleanupData.bind(this), 2.5 * 1000);
    this._nextStats = setTimeout(this._calculateStats.bind(this), 90 * 1000);
   
  }

  destroy() {
    this._bridge.stopServer();

    this._db.run('VACUUM');      // compress the database on close
    this._db.close();

    clearTimeout(this._nextCleanup);
    clearTimeout(this._nextStats);
  }

  get settings() {
    return this._settings;
  }
  set settings(value) {
    this._settings = value;

    this.create_database();
  }
  get db() {
    return this._db;
  }

}

module.exports = GinlongSrv;

/*
 * create timestamp for logging on screen
 */
const getTimestamp = () => {
  const current_datetime = new Date();

  return current_datetime.getFullYear() + '-' + (current_datetime.getMonth() + 1).toString().padStart(2, '0')  
                             + '-' + current_datetime.getDate().toString().padStart(2, '0') + ' ' 
                             + current_datetime.getHours().toString().padStart(2, '0') + ':' 
                             + current_datetime.getMinutes().toString().padStart(2, '0') + ':' 
                             + current_datetime.getSeconds().toString().padStart(2, '0');
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

  try {
    const bufData = Buffer.from(JSON.parse(element.data));
    if ((bufData[0] == 0x68) && (bufData[Buffer(bufData).length - 1] == 0x16)) {
      protoData = after.analyze_Solarman_1(bufData);
      if (this._settings.verbose) {
        console.log('  Solarman-1 detected -> len : ' + bufData.length + '(' + parseInt(bufData[1]) + ')');
        //console.log('  --> ' + bufData.toString('hex'));
      }
      protocol = 'SOL_1';
    } else if ((bufData[0] == 0xa5) && (bufData[bufData.length - 1] == 0x15)) {
      protoData = after.analyze_Solarman_Ethernet(bufData);
      if (this._settings.verbose) {
        console.log('  Solarman-Ethernet detected -> len : ' + bufData.length + '(' + parseInt(bufData[1]) + ')');
        //console.log('  --> ' + bufData.toString('hex'));
      }
      protocol = 'SOL_E';
    } else {
      //const dt = new Date();
      console.warn('  unknown protocol (' + getTimestamp() + ') -> len : ' + bufData.length + '(' + parseInt(bufData[1]) + ')');
      console.log('  --> ' + bufData.toString('hex'));
      protocol = 'UNKNOWN';
    }
  
    if (protoData != null) {
      this._storeLog(element.time, protoData, cleanup);

      if (this._settings.events) {              // emit an event, transfer data
        this.emit('data', protoData);
      }
    }
    this._updateReceived(element.port, element.time, protocol, protoData);
  } catch (error) {
    console.error('process received error ' + error);
  }

};

/*
 *
 */
GinlongSrv.prototype._updateReceived = function(port, unixtime, protocol, protoData) {
  const updStmt = 'UPDATE received SET seen = 1, proto = ?, json = ? WHERE port = ? AND time = ?';
  this._db.run(updStmt, [protocol, JSON.stringify(protoData), port, unixtime]);
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
          console.warn('stats - no power - ' + JSON.stringify(data.payload));
          data.payload.e_tod = 0;
        }
  
        // avoid spikes at beginning of the day with 'yesterdays' e-today value 
        if ((stats.e_today == 0) && (data.payload.e_tod.toFixed(1) > 0.3) && (data.payload.e_cur.toFixed(1) == 0.0)) {
          const curDate = new Date();
          if (curDate.getHours() < 9) {
            console.warn('stats - no energy - ' + JSON.stringify(data.payload));
            data.payload.e_tod = 0;
          }
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

  console.warn(getTimestamp() + ' * cleanup started');

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
        if (this._settings.verbose) {
          console.log('   start processing data');    
        }

        this._db.run('BEGIN TRANSACTION');
        rows.forEach((row) => {
          this._processReceived(row, true);
        });
        this._db.run('COMMIT');
        if (this._settings.verbose) {
          console.log('   finished processing data');
        }
        
        console.warn(getTimestamp() + ' * cleanup completed');
      });
      

    });

    this._db.run('BEGIN TRANSACTION');
    // cleanup reception data
    let diffTime = this._calcDateDiff(unixTime, this.settings.purgeRecv.after);
    if (this._settings.verbose) {
      console.log('purge recv = now: ' + unixTime + ' - diff: ' + diffTime);
    }
    if (this._settings.purgeRecv.onSeen) {
      this._db.run('DELETE FROM received WHERE seen > 0 AND time < ?', [diffTime]);
      this._db.run('DELETE FROM received WHERE seen = 0 AND time < ?', [diffTime - (10*24*60*60)]);   // 10 days before
    } else {
      this._db.run('DELETE FROM received WHERE seen = 0 AND time < ?', [diffTime]);
    }
    
    // cleanup log data
    diffTime = this._calcDateDiff(unixTime, this.settings.purgeLog.after);
    if (this._settings.verbose) {
      console.log('purge logs = now: ' + unixTime + ' - diff: ' + diffTime);
    }
    if (this._settings.purgeLog.onSeen) {
      this._db.run('DELETE FROM logs WHERE seen > 0 AND time < ?', [diffTime]);
      this._db.run('DELETE FROM logs WHERE seen = 0 AND time < ?', [diffTime - (10*24*60*60)]);   // 10 days before
    } else {
      this._db.run('DELETE FROM logs WHERE seen = 0 AND time < ?', [diffTime]);
    }
    
    this._db.run('COMMIT');
  });

} ;

/*
 * check loggings to allow accurate graphs
 */
GinlongSrv.prototype._calculateStats = function() {
  this._nextStats = setTimeout(this._calculateStats.bind(this), 5 * 60 * 1000);       // every 5 minutes

  const statSql = 
    `SELECT STRFTIME("%s", DATETIME("now", "start of day")) AS time_sod, STRFTIME("%s", "now") AS time_now,
            COALESCE(MAX(time), STRFTIME("%s", "now")) AS timestamp, 
            COALESCE(serial, "no_serial") AS serial, 
            COALESCE(e_today, 0) AS e_today, COALESCE(e_total, 0) AS e_total, COALESCE(e_prev, 0) AS e_prev 
       FROM logs`;
  this._db.get(statSql, (err, row) => {

    if (this._settings.verbose) {
      console.log(getTimestamp() + ' - calculating extra statistics');
    }
    if (err) {
      console.error('error calculating stats : ' + err.message);
      return;
    }

    const logsStmt = 'INSERT INTO logs (seen, time, serial, e_cur, e_today, e_total, e_prev) VALUES (0, ?, ?, ?, ?, ?, ?)';
    const recvStmt = 'INSERT INTO received (seen, port, time, data, json) values (1, 9999, ?, ?, ?)';
    if (row.timestamp < row.time_sod) {
      console.warn(getTimestamp() + ' - adding logs before and after midnight');
      // before midnight, last status of e_today
      this._db.run(logsStmt, [(Number(row.time_sod) - 60), row.serial, row.e_cur, row.e_today, row.e_total, row.e_prev], (err) => {
        if (err) {
          console.error('calcStats: update before error: ' + err.message);
        }
      });
      this._db.run(recvStmt, [(Number(row.time_sod) - 60), row, JSON.stringify(row)], (err) => {
        if (err) {
          console.error('calcStats recv: insert before error: ' + err.message);
        }
      });
      // after midnight, zero out e_today
      this._db.run(logsStmt, [(Number(row.time_sod) + 60), row.serial, 0, 0, row.e_total, row.e_prev], (err) => {
        if (err) {
          console.error('calcStats: update after error: ' + err.message);
        }
      });
      this._db.run(recvStmt, [(Number(row.time_sod) + 60), row, JSON.stringify(row)], (err) => {
        if (err) {
          console.error('calcStats recv: insert after error: ' + err.message);
        }
      });
    } else if (row.time_now > row.timestamp + 1800) {
      console.warn(getTimestamp() + ' - adding log 30min without data');
      // add a logline for 30min without logging 
      // --> take 15s earlier, otherwise the inserted records will shift over time
      this._db.run(logsStmt, [(Number(row.time_now) - 15), row.serial, row.e_cur, row.e_today, row.e_total, row.e_prev], (err) => {
        if (err) {
          console.error('calcStats: insert error: ' + err.message);
        }
      });
      this._db.run(recvStmt, [(Number(row.time_now) - 15), row, JSON.stringify(row)], (err) => {
        if (err) {
          console.error('calcStats recv: insert error: ' + err.message);
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
            COALESCE(MAX(time), -1) as laststamp,
            COALESCE(serial, "no_serial") as serial, 
            COALESCE(e_today, -1) as e_today, COALESCE(e_total, -1) as e_total 
       FROM logs`;

  return new Promise((resolve, reject) => {

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
      if (this._settings.verbose) {
        console.log('stats = ' + JSON.stringify(result));
      }

      resolve(result);
  
    });
  });

};

