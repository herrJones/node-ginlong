'use strict';

const loki = require('lokijs');
const sqlite3 = require('sqlite3').verbose();

let lokiDb = new loki(__dirname + '/ginlong.json', {
  autoload: true,
  autoloadCallback : () => {
    const entries = lokiDb.getCollection('inverters');
    if (entries === null) {
      // list of received data -> should be cleaned up as soon as possible
      lokiDb.addCollection('received', { indices : ['port', 'seen', 'time']});

      // list of 'raw data', received from the inverter
      lokiDb.addCollection('raw', { indices : ['time', 'seen']});
    
      // list of invertors 
      lokiDb.addCollection('inverters');
    
      // log of received data
      lokiDb.addCollection('logs', { indices : ['time', 'seen']});
    
      // calculated statistics
      lokiDb.addCollection('stats', { indices : ['time']});
    
    }
  }
});
let sqliteDb = new sqlite3.Database(__dirname + '/ginlong.db3', (err) => {
  if (err) {
    return console.error(err.message);
  }
});

sqliteDb.serialize(() => {
  //sqliteDb.run(`CREATE TABLE IF NOT EXISTS rawdata (
  //  seen    INTEGER DEFAULT 0,
  //  time    INTEGER NOT NULL,
  //  proto   TEXT,
  //  data    BLOB
  //)`);
  //sqliteDb.run(`CREATE INDEX IF NOT EXISTS idx_raw_time_seen
  //  ON rawdata(time, seen)`);

  sqliteDb.run(`CREATE TABLE IF NOT EXISTS received (
      seen    INTEGER DEFAULT 0,
      port    INTEGER NOT NULL,
      time    INTEGER NOT NULL,
      proto   TEXT DEFAULT '',
      data    BLOB
    )`);
  sqliteDb.run(`CREATE INDEX IF NOT EXISTS idx_recv_time_seen
      ON received(time, seen)`);
  sqliteDb.run(`CREATE INDEX IF NOT EXISTS idx_recv_port
      ON received(port)`);

  sqliteDb.run(`CREATE TABLE IF NOT EXISTS logs (
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
  sqliteDb.run(`CREATE INDEX IF NOT EXISTS idx_logs_time
    ON logs(time)`);

});

function transfer() {
  let lokiCollect = lokiDb.getCollection('inverters');
  let lokiData = lokiCollect.find();
//  let invList = lokiData;


  /*
  lokiCollect = lokiDb.getCollection('logs');
  lokiData = lokiCollect.find();
  sqliteDb.run('BEGIN TRANSACTION');
  let invId = -1;
  let serial = '';
  lokiData.forEach((element) => {
    if (invId != element.inverter) {
      //.find({'id' : { '$eq' : element.inverter }});
      serial = invList[element.inverter - 1].serial;
      invId = element.inverter;
    }

    sqliteDb.run(`INSERT INTO logs (serial, time, seen, temp, 
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
                                    ?,?)`, [serial, element.time, element.seen, element.temp,
                                            element.vpv1, element.vpv2,
                                            element.ipv1,element.ipv2,
                                            element.iac1,element.iac2,element.iac3,
                                            element.vac1,element.vac2,element.vac3,
                                            element.fac,element.pac,
                                            element.e_today,element.e_total], (err) => {
      if (err) {
        console.log('error inserting inverter: ' + err.message);
      }
    });
  });
  sqliteDb.run('COMMIT');
*/
  lokiCollect = lokiDb.getCollection('received');
  lokiData = lokiCollect.find();
  sqliteDb.run('BEGIN TRANSACTION');
  lokiData.forEach((element) => {
    sqliteDb.run('INSERT INTO received (seen, time, port, data) VALUES (?, ?, ?, ?)', [0, element.time, element.port, JSON.stringify(element.data)], (err) => {
      if (err) {
        console.log('error inserting inverter: ' + err.message);
      }
    });
  });
  sqliteDb.run('COMMIT');

  //lokiCollect = lokiDb.getCollection('raw');
  //lokiData = lokiCollect.find();
  //sqliteDb.run('BEGIN TRANSACTION');
  //lokiData.forEach((element) => {
  //  sqliteDb.run('INSERT INTO rawdata (seen, time, proto, data) VALUES (?,?,?,?)', [element.seen, element.time, element.proto, JSON.stringify(element.data)], (err) => {
  //    if (err) {
  //      console.log('error inserting inverter: ' + err.message);
  //    }
  //  });
  //});
  //sqliteDb.run('COMMIT');

  sqliteDb.close((err) => {
    if (err) {
      console.error('failed closing database');
    }
  });
}

setTimeout(() => {
  transfer();
}, 5000);

