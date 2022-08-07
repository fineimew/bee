---
title: OPQ Health
sidebar_label: Health
---

The goal of the OPQHealth service is provide a diagnostic facility for determining whether or not the OPQ hardware and software services appear to be running appropriately.  It does this by monitoring aspects of the system and publishing its findings to two sources:

  1. The MongoDB database, in a collection called "health".  By storing its findings in MongoDB, OPQHealth enables OPQView to provide an interface to end-users on the health of the OPQ system. However, this works only as long as both OPQView and MongoDB are healthy.

  2. A log file. OPQ Health also publishes its findings into a text file. This enables system administrators to diagnose the health of the system even when MongoDB and/or OPQView are down.

## Basic operation

When OPQHealth starts up, it reads its configuration file to determine what services it should monitor and how frequently it should monitor them.  

Thereafter, it checks each service at the interval specified in its configuration file, and writes out a line to the logfile and a document to the Health database indicating the status. 

For more details on the logged data, see the [Health Data Model](cloud-datamodel.md#health). 


## Installation

To install OPQHealth, you must first set up the configuration file.  A sample configuration file is in json format and looks like this:

```js
[
    {
        "service": "zeromq",
        "port": "tcp://127.0.0.1:9881"
    },
    {
        "service": "box",
        "interval": 60,
        "boxdata": [
          { "boxID": 1 },
          { "boxID": 2 },
          { "boxID": 3 },
          { "boxID": 4 },
          { "boxID": 5 },
          { "boxID": 6 }
        ]
    },
    {
        "service": "mauka",
        "interval": 60,
        "url": "http://localhost:8911",
        "plugins": [
            "StatusPlugin",
            "IticPlugin",
            "AcquisitionTriggerPlugin",
            "VoltageThresholdPlugin",
            "ThdPlugin",
            "FrequencyThresholdPlugin"
        ]
    },
    {
        "service": "makai",
        "interval": 60,
        "mongo": "mongodb://localhost:27017/",
        "acquisition_port": "tcp://localhost:9884"
    },
    {
        "service": "view",
        "interval": 60,
        "url": "http://emilia.ics.hawaii.edu"
    },
    {
        "service": "mongodb",
        "interval": 60,
        "url": "mongodb://localhost:27017/"
    },
    {
        "service": "health",
        "interval": 86400
    }
]
```

The configuration file is an array of objects.  Every object has a field called "service", which indicates which service the object provides configuration data for.  The remaining fields can vary depending upon the value of the service field.

Most configuration objects have a field called "interval", which specifies the frequency in seconds with which OPQHealth should check on that service. In the example above, most services are checked once a minute, though OPQHealth checks on itself once a day.

To run OPQHealth, cd into the health/ directory and invoke OPQHealth as follows:

```
$ python3 health.py -config configuration.json -log logfile.txt
... reading configuration information from configuration.json
... writing out initial health status to logfile.txt
```

Upon startup, OPQHealth prints out information indicating that it successfully read the configuration file and successfully wrote initial entries to the specified logfile. Afterwards, it does not write anything to the console. Here is an example of the log file after startup:

```
20180318-09:08:21-10:00 service: box, serviceID: 0, status: up, info:
20180318-09:08:21-10:00 service: box, serviceID: 1, status: up, info:   
20180318-09:08:22-10:00 service: box, serviceID: 2, status: down, info:   
20180318-09:08:22-10:00 service: mauka, serviceID:, status: up, info:   
20180318-09:08:22-10:00 service: makai, serviceID:, status: up, info:   
20180318-09:08:22-10:00 service: mongodb, serviceID:, status: up, info:   
20180318-09:08:22-10:00 service: view, serviceID:, status: up, info:   
```

The log file prints out the value of all fields in the data model, comma separated. 

Note that each time an entry is added to the log file, a corresponding document is inserted into the health collection.

## Detecting health

OPQHealth assesses the health of each service in the following way:

*OPQ Box*:  For an OPQBox to have status "up", it must have sent at least one message to the ZeroMQ service within the past 5 minutes.

*Mauka*: For Mauka to have the status up, Mauka's health http endpoint must respond with status code 200 and valid json containing a dict of plugins and a timestamp for each of the plugin's last "heartbeat." Each Mauka plugin will have its own health status, which is considered up if its provided timestamp is within the past 5 minutes. A health status is only provided for plugins specified in the config.json

*Makai*: For Makai to have the status up, three things must happen. (1) Boxes must be sending measurements. (2) Must be able to request events from Makai's acquisition broker. (3) The requested event must appear in mongodb.

*MongoDB*: For MongoDB to have status up, OPQHealth must be able to successfully retrieve a document from the health collection.

*View*: For OPQView to have status "up", OPQHealth must be able to retrieve the landing page with status 200.


## Docker

Please see [Building, Publishing, and Deploying OPQ Cloud Services with Docker](cloud-docker.html) for information on packaging up this service using Docker. 
