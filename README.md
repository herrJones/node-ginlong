# ginlong-node
Node.JS parsing of Ginlong/Solis pv-panel data 

The received data is stored in an InfluxDB database.

Inspired by the various python implementations (ginlong-wifi / ginlong-mqtt /domoticz / ...)

A powershell script is provided to import historic data into the Influx database.
The import is based on the daily/weekly reports provided by ginlongmonitoring.com
