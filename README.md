# node-ginlong
Node.JS module parsing of Ginlong/Solis pv-panel data 

Inspired by the various python implementations (ginlong-wifi / ginlong-mqtt / domoticz / ...)
Improved by adding an extra protocol.

Protocols available:
* *Solarman-1*
* ***Solarman-Ethernet***

The received data is stored in a SQLite database.
The previously used Loki.JS database has been dropped.
A conversion script has been created to convert existing data into a sqlite database

It is up to the main program to do something with the received data.
Via settings, the module can emit events on reception of new data.

3 testing programs are provided (WIP):
* **ginlongTest** : can send data (from CSV file) as if it were an inverter
* **ginlongServer** : demo module for receiving data from an inverter
* **convert_db** : convert previous LokiJS database to SQLite. (The LokiJS database must be placed in the same folder as this script)

## Quick-start

```javascript
const solarSrv = require('node-ginlong')
var solarData = new solarSrv();
solarData.create();

const settings = solarData.settings;
settings.verbose = false;
settings.events = true;
settings.db_path = 'my_local_path';
solarData.settings = settings;

function getData() {
    const db = solarData.db;
    // *****
}

const statistics = await solarData.getStats();

solarData.on('data', (data) => {
  // do something
})
```


