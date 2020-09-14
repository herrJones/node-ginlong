# node-ginlong
Node.JS module parsing of Ginlong/Solis pv-panel data 

Protocols available:
* Solarman-1
* Solarman-Ethernet

Inspired by the various python implementations (ginlong-wifi / ginlong-mqtt / domoticz / ...)
Improved by adding an extra protocol.

The received data is stored in a SQLite database.
The previously used Loki.JS database has been dropped.
A conversion script has been created
It is up to the main program to do something with this data.

3 testing programs are provided (WIP):
* ginlongTest : can send data (from CSV file) as if it were an inverter
* ginlongServer : demo module for receiving data from an inverter
* convert_db : convert previous LokiJS database to SQLite
