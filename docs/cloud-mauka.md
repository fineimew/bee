---
title: OPQ Mauka
sidebar_label: Mauka
---

OPQ Mauka is a distributed plugin-based middleware for OPQ that provides higher level analytic capabilities. OPQ Mauka provides analytics for classification of PQ events, aggregation of triggering data for long term trend analysis, community detection, statistics, and metadata management. It is intended to provide the following capabilities:

* Recording long term trends from triggering measurements
* Classification of voltage dip/swells
* Classification of frequency dip/swells
* Requests of raw data for higher level analytics, including:
  * Community detection
  * Grid topology
  * Global/local event detection/discrimination
  * Integration with other data sources (_i.e._ PV production) 

## Design

### Overview

OPQMauka is written in Python 3.7 and depends on 2 ZMQ brokers as well as a Mongo database. The architecture of OPQMauka is designed in such a way that all analytics are provided by plugins that communicate using publish/subscribe semantics using ZMQ. This allows for a distributed architecture and horizontal scalability. 

### Mauka Services

Mauka utilizes several services that are started as separate processes in order to function. Diagram of these services and utilized ports are provided below. Followed by their descriptions.

All items within the blue box are components that together make up OPQMauka. This first diagram shows how Mauka interacts with other parts of OPQ.
<img src="/docs/assets/mauka/mauka_integration_diagram.png">

This second diagram displays the port mappings between Mauka components and other OPQ services.
<img src="/docs/assets/mauka/mauka_port_diagram.png">

| Service | Description |
|---------|-------------|
| Makai Event Bridge | Provides event id numbers to the `MakaiEvent` topic. Data is bridged over a ZMQ proxy.  |
| Mauka Pub/Sub Broker | Provides a Publish/Subscribe ZMQ broker to all Mauka plugins. This is how plugins within Mauka communicate with each other. |
| Mauka Plugin Manager | This is a process that manages plugin processes. It also allows developers to interact with plugins at runtime through the Mauka CLI. |
| Mauka CLI | This provides a networked command line interface for interfacing with the Mauka Plugin Manager to manage plugins at runtime. |

### Mauka Plugins

The OPQMauka processing pipeline is implemented as a directed acyclic graph (DAG). Communication between vertexes in the graph is provided via ZeroMQ. Each node in the graph is implemented by an OPQMauka Plugin. Each plugin runs as a seperate process allowing scalability to distributed systems. Additional analysis plugins can be added to OPQMauka at runtime, without service interruption.

Each OPQMauka Plugin provides a set of topics that it subscribes to and a set of topics that it produces. These topics form the edges between vertexes in our graph. Because each plugin is independent and only relies on retrieving and transmitting data over ZeroMQ, plugins can be implemented in any programming language and executed on any machine in a network. This design allows us to easily scale plugins across multiple machines in order to increase throughput.3.

Below is a figure of the current plugin architecture.

<img src="/docs/assets/mauka/mauka_functional_diagram.png">

This figure shows Mauka's  class inheritance structure.

<img src="/docs/assets/mauka/mauka_class_inheritance_diagram.png">


### Base Plugin (MaukaPlugin)

The [base plugin](https://github.com/openpowerquality/opq/blob/master/mauka/plugins/base_plugin.py) is a base class which implements common functionally across all plugins. This plugin in subclassed by all other OPQMauka plugins. The functionality this plugin provides includes:

* Access to the underlying Mongo database
* Automatic publish subscribe semantics with ```on_message``` and ```publish``` APIs (via ZMQ)
* Configuration/JSON parsing and loading
* Python multiprocessing primitives 
* Status/heartbeat notifications

The base plugin produces heartbeats at a configurable amount of time which can be modified using the ```plugins.base.heartbeatIntervalS``` configuration option.

### Acquisition Trigger Plugin

The [acquistion trigger plugin](https://github.com/openpowerquality/opq/blob/master/mauka/plugins/acquisition_trigger_plugin.py) subscribes to all events and forms event request messages to send to OPQMakai to enable the retrieval of raw power data for higher level analytics.

This plugin employs a deadzone between event messages to ensure that multiple requests for the same data are not sent in large bursts, overwhelming OPQBoxes or OPQMakai. The deadzone by default is set to 60 seconds, but can be configured by setting the ```plugins.AcquisitionTriggerPlugin.sDeadZoneAfterTrigger``` key in the configuration. If this plugin encounters an event while in a deadzone, a request is still generated and sent to OPQMakai, however a flag is set indicating to Makai that raw data should not be requested. 

The amount of data requested from Makai is padded on either end with a configurable amount of padding time tunable by the ```plugins.AcquisitionTriggerPlugin.msBefore``` and ```plugins.AcquisitionTriggerPlugin.msAfter``` configuration options.

### Frequency Variation Plugin

The [frequency variation plugin](https://github.com/openpowerquality/opq/blob/master/mauka/plugins/frequency_variation_plugin.py) subscribes to WindowedFrequency messages and classifies frequency incidents as frequency swells, frequency interruptions, and frequency sags. These classifications can be parameterized by tuning the threshold and duration values that these incidents are fired on.

When thresholds are tripped, frequency events are generated and published to the system. These are most importantly used to generate event triggering requests to OPQMauka to request raw data from affected devices.

The frequency reference is defined by the ```plugins.FrequencyVariationPlugin.frequency.ref``` config key. 

Frequency thresholds are defined by the ```plugins.FrequencyVariationPlugin.frequency.variation.threshold.low``` and ```plugins.FrequencyVariationPlugin.frequency.variation.threshold.high``` keys.

Frequency interruptions are defined using the ```plugins.FrequencyVariationPlugin.frequency.interruption``` config key.

The number of lull windows can be set with ```plugins.FrequencyVariationPlugin.max.lull.windows```.

### IEEE 1159 Voltage Plugin
The [IEEE1159 voltage event plugin](https://github.com/openpowerquality/opq/blob/master/mauka/plugins/ieee1159_voltage_plugin.py) subscribes to all events that request data, analyzes the waveforms, and stores classified incidents back in the database. A received waveform is analyzed for continuous segments with non-nominal amplitudes. There are two important features of these segments that are considered for classification: duration and relative amplitude. The duration is the length of the segment in periods and/or seconds. The relative amplitude, which is defined per window (e.g period) of a waveform, is given as the actual divided by the nominal amplitude (where nominal is as specified by country/region).

The IEE1159 documentation specifies incidents by ranges of values for duration and relative amplitudes of a segment. The categories include undervoltage, overvoltage, and interruption (describing events lasting longer than a minute) and instantaneous, momentary, and temporary dips and swells (for shorter timescales). For example, a stretch with relative amplitudes between 0.1 and 0.9 that lasts 0.5 to 30 periods is classified as an instantaneous dip.

### ITIC Plugin 

The [ITIC plugin](https://github.com/openpowerquality/opq/blob/master/mauka/plugins/itic_plugin.py) subscribes to all events that request data, waits until the data is realized, performs ITIC calculations over the data, and then stores the results back to the database.

This plugin subscribes to events that request data and also ITIC specific messages so that this plugin can be triggered to run over historic data as well. The amount of time from when this plugin receives a message until it assumes the data is in the database can be configured in the configuration file. 

The ITIC calculations are computed in a separate thread and the results are stored back to the database. 

ITIC regions are determined by plotting the curve and performing a point in polygon algorithm to determine which curve the point falls within.

The ITIC plugin uses segmentation to determine segments of stable Vrms values. The Vrms threshold for segmentation is configurable by setting the ```plugins.IticPlugin.segment.threshold.rms``` config option.

### Makai Event Plugin

The [makai event plugin](https://github.com/openpowerquality/opq/blob/master/mauka/plugins/makai_event_plugin.py) subscribes to MakaiEvent messages which contains an integer representing the id of an event that Makai generated and stored to the database. This plugin receives event notifications from Makai asynchronously. When an event notification is received, this plugin goes to the database, reads the raw waveform, and then publishes the raw waveform, calibrated waveform, windowed Vrms, and windowed frequency to any plugins that performs analysis on those data types.

The Makai Event plugin provides the following configuration options and default values:

```json
"plugins.MakaiEventPlugin.getDataAfterS": 10.0,
"plugins.MakaiEventPlugin.filterOrder":4,
"plugins.MakaiEventPlugin.cutoffFrequency": 500.0,
"plugins.MakaiEventPlugin.frequencyWindowCycles": 1,
"plugins.MakaiEventPlugin.frequencyDownSampleRate": 2
```

### Outage Plugin

The [outage plugin](https://github.com/openpowerquality/opq/blob/master/mauka/plugins/outage_plugin.py) subscribes to heatbeats and on each heartbeat checks queries the health collection of the database to determine if a box has been down for a specified period of time.

If a box appears as down and is not marked as unplugged, then this plugin produces and outage incident which is stored to the database.

### Print Plugin

The [print plugin](https://github.com/openpowerquality/opq/blob/master/mauka/plugins/print_plugin.py) subscribes to all topics and prints every message. This plugin is generally disabled and mainly only useful for debugging purposes.

### Semi F47 Plugin

The [semi f47 plugin](https://github.com/openpowerquality/opq/blob/master/mauka/plugins/semi_f47_plugin.py) classifies voltage incidents according to the Semi F47 standard. This standard was designed to model how voltage dips can cause damage to semiconductor equipment.

### Status Plugin

The [status plugin](https://github.com/openpowerquality/opq/blob/master/mauka/plugins/status_plugin.py) subscribes to heartbeat messages and logs heartbeats from all other plugins (including itself). Also provides an HTTP endpoint so the status of Mauka, Mauka services, and Mauka plugins can be ascertained by other services.

The ```plugins.StatusPlugin.port``` config option can be changed to specify the port that the status plugin should run on.

### Total Harmonic Distortion Plugin
The [total harmonic distortion (THD) plugin](https://github.com/openpowerquality/opq/blob/master/mauka/plugins/thd_plugin.py) subscribes to all events that request data, waits until the data is realized, performs THD calculations over the data, and then stores the results back to the database.

This plugin subscribes to events that request data and also THD specific messages so that this plugin can be triggered to run over historic data as well. The amount of time from when this plugin receives a message until it assumes the data is in the database can be configured in the configuration file. 

The THD calculations are computed in a separate thread and the results are stored back to the database. 

### Transient Plugin

The [transient plugin] is capable of discriminating between several different transient types. A decision tree is used to prune possibilities by extracting features from the PQ data. The transient classes this plugin is able to classify include impulsive, arcing, oscillatory, and periodic notching. 

The following configuration options are used for the transient plugin which shows the options and the default values:

```json
"plugins.TransientPlugin.noise.floor" : 6.0,
"plugins.TransientPlugin.oscillatory.min.cycles" : 3,
"plugins.TransientPlugin.oscillatory.low.freq.max.hz" : 5000.0,
"plugins.TransientPlugin.oscillatory.med.freq.max.hz" : 500000.0,
"plugins.TransientPlugin.oscillatory.high.freq.max.hz" : 5000000.0,
"plugins.TransientPlugin.arcing.zero.crossing.threshold" : 10,
"plugins.TransientPlugin.max.lull.ms" : 4.0,
"plugins.TransientPlugin.max.periodic.notching.std.dev" : 2.0,
"plugins.TransientPlugin.auto.corr.thresh.periodicity" : 0.4
```

## Development

### Obtaining the sources

1. Clone the master branch of the OPQ project at: https://github.com/openpowerquality/opq
2. OPQ Mauka sources can be located at opq/mauka

### Directory structure and layout

The top level of the `opq/mauka` directory contains the following files:

| Files | Description |
|-------|-------------|
| analysis.py | High level helper functions for time conversions and signal segmentation |
| config.json | Default key-value based configuration values for Mauka |
| config.py | Provides functions for loading configurations and providing default values |
| constants.py | Python module providing constant values. |
| incident_viewer.py | Script for displaying Mauka classified incidents. |
| log.py | Contains a top level mauka level logging interface. |
| mongo.py | Python module providing high level access to the OPQ Mongo database. |
| opq_mauka.py | Entry point into OPQ Mauka. Provides high level management of plugins. Starts and manages Mauka services. |
| requirements.txt | List of Python dependencies required by Mauka. |
| rerun_incidents.py | This script provides functionality for rerunning all past incidents through new or updated analysis plugins. |
| .coafile | Contains rules for Mauka style checking |

The top level of the `opq/mauka` directory contains the following directories:

| Directory | Description |
|-------|-------------|
| api_docs | Contains tool generated API documentation. |
| deploy | Contains scripts for building and deploying Mauka to emilia or OPQ Sim. (deprecated, use docker deploy)|
| diagrams | Contains mauka system diagrams generated using the graph description language and graphviz |
| docker | Contains scripts for building, publishing, and running docker images for Mauka. |
| plugins | Contains all Mauka plugin modules |
| profilers | Contains profilers designed to profile mauka plugins. |
| protobuf | Contains the Python protobuf wrapper for OPQ as well as some utilities. This is mainly needed for working with Makai. |
| services | Contains modules that build the Mauka services layer. |
| tests | Mauka tests directory. |


### Running in development

To test OPQ Mauka in a development environment, you can use OPQ Sim.

1. Install and become familiar with [OPQ Sim](developerguide-virtual-machine.md).
2. Use the [included deployment scripts](deploy-mauka.md) to deploy an OPQ Mauka bundle to to OPQ Sim.
3. Follow the instructions included with the VM guide to generate PQ events on the simulator.


### Plugin Development

The following steps are required to create a new OPQMauka plugin:

1. Create a new Python module for the plugin in the plugins package (i.e. my_fancy_plugin.py). Ensure that the plugin module name follows PEP 8 conventions.

2. import the plugin base modules
```python
import plugins.base_plugin
import protobuf.mauka_pb2
import protobuf.util
```

3. Create a class that extends the base plugin.
```python
class MyFancyPlugin(plugins.base_plugin.MaukaPlugin):
      ...
```

5. Provide the following constructor for your class. Ensure the a call to super provides the configuration, list of topics to subscribe to, and the name of the plugin. Finally, a multiprocess exit event object is passed to the base class with allows the plugin manager to safely terminate plugins.
```python
def __init__(self, config, exit_event):
      NAME = "MyFancyPlugin"
      def __init__(self, config: typing.Dict, exit_event: multiprocessing.Event):
              """
              Initializes this plugin
              :param config: Mauka configuration
              :param exit_event: Exit event that can disable this plugin from parent process
              """
              super().__init__(config, ["SubscribeTopicA", "SubscribeTopicB"], MyFancyPlugin.NAME, exit_event)
```

6. Overload the ```on_message``` from the base class and use the protobuf utils to check to ensure your receiving a message of a type that the plugin expects.
```python
def on_message(self, topic, mauka_message):
    """
    Fired when this plugin receives a message. 
    :param topic: Topic of the message.
    :param mauka_message: Contents of the message.
    """
    if protobuf.util.is_payload(mauka_message, protobuf.mauka_pb2.MESSAGE_TYPE): # Replace MESSAGE_TYPE with proper type
        self.debug("on_message {}:{} len:{}".format(mauka_message.payload.event_id,
                                                    mauka_message.payload.box_id,
                                                    len(mauka_message.payload.data)))
        # Call the function that handles the recvieved message. Something like below...
        handle_message(arg0, arg1, ..., argN)
    else:
        self.logger.error("Received incorrect mauka message [%s] at ThdPlugin",
                          protobuf.util.which_message_oneof(mauka_message))
```

7. Produce messages by invoking the superclasses produce method where message is an instance of a mauka protobuf message.
```python
self.produce(topic: str, message)
```

8. Import  your plugin in ```mauka/opq_mauka.py```.
```python
import plugins.my_fancy_plugin
```

9. Register your plugin in ```mauka/opq_mauka.py```.
```python
plugin_manager.register_plugin(plugins.my_fancy_plugin.MyFancyPlugin)
```

### Suggested Subscriptions

When developing a new Mauka plugin, it's likely there there is already a data source that you can subscribe to. The MakaiEventPlugin publishes both high and low fidelity data streams when events are triggered by OPQMakai. These data streams can be subscribed to by other Mauka plugins. These message types include:

```AdcSamples``` which provide raw ADC samples sampled by the OPQBox.

```RawVoltage``` which converts the ADC samples in raw voltage samples.

```RmsWindowedVoltage``` provides Vrms features from a voltage waveform where Vrms is calculated by cycle.

```WindowedFrequency``` provides frequency features calculated at the cycle level from the original power waveform.

### Message Injection

It's nice to think of Mauka as a perfect DAG of plugins, but sometimes its convenient to dynamically publish (topic, message) pairs directly into the Mauka system.

This is useful for testing, but also useful for times when we want to run a plugin of historical data. For instance, let's say a new plugin Foo is developed. In order to apply Foo's metric to data that has already been analyzed, we can inject messages into the system targetting the Foo plugin and triggering it to run over the old data.

This functionality is currently contained in [plugins/mock.py](https://github.com/openpowerquality/opq/blob/master/mauka/plugins/mock.py).

The script can either be used as part of an API or as a standalone script. As long as the URL of Mauka's broker is known, we can use this inject messages into the system. This provides control over the topic, message contents, and the type of the contents (string or bytes).

### Testing

Mauka utilizes Python's built-in support for [unit testing](https://docs.python.org/3/library/unittest.html). 

Unit tests should be used to test the analysis functionality of every Mauka plugin. Tests are currently laid out in the following manner.

```
opq/mauka/tests
  + /services
  + /plugins 
``` 

Unit tests that tests Mauka services (such as the brokers or plugin manager) should reside in `tests/services`. Unit tests for plugins should reside in `tests/plugins`. Every testing sub-directory must include a `__init__.py` file.

Every plugin should have a module in the `tests/plugins` directory that directly tests a Mauka plugin. Every plugin module should be named test_<i>PluginName</i>.py

Each test plugin module must contain a class (which is the same name as the module) that then extends `unittest.TestCase`.

An example of this layout can be seen at `mauka/tests/plugins/test_itic_plugin.py`.

To run all unit tests, run `python -m unittest discover` from the `opq/mauka` directory. This command will recursively discover all unittests in the tests directory and run them.

```
(venv-opq) [anthony@localhost mauka]$ python3 -m unittest discover
......
----------------------------------------------------------------------
Ran 6 tests in 0.003s

OK
```

### Development Guidelines

1. Follow the [pep 8](https://www.python.org/dev/peps/pep-0008/) Python coding convention (see also http://pep8.org/#introduction). If any of the other following guidelines contradict the pep 8 standard, use the following instead of the standard.
2. Lines must be < 120 characters 
2. Variables, functions, methods, and modules should be [snake_case](https://en.wikipedia.org/wiki/Snake_case)
3. Classes should use [CapitalCamelCase](https://en.wikipedia.org/wiki/Camel_case)
4. Constants and enumeration values should be SNAKE_CASE_ALL_CAPS
5. Modules should provide module level documentation at the top of every .py file that briefly describes the purpose and contents of the module
6. Functions and methods should document their purpose, input, and output as Python [docstrings](http://docs.python-guide.org/en/latest/writing/documentation/).
7. Do not add type information to documentation, instead provide type information using Python's built-in [type hints](https://docs.python.org/3/library/typing.html) (see also https://www.python.org/dev/peps/pep-0484/)
8. Whenever practical and when types are known, provide type hints for class variables, instance variables, and function/method inputs and return types. The type hints are not enforced at runtime, but merely provide compile time hints. These are most useful in conjunction with an IDE so that your editor can highlight when input or return types do not match what is expected.
9. Whenever a new plugin is developed, update OPQ's [docusaurus](https://github.com/openpowerquality/docusaurus) to provide a high-level and technical documentation on the plugin. Mauka Diagrams may also need to be updated.  
10. Whenever you commit or merge to master, ensure the Mauka code base passes all static analysis checks and all unit tests pass.

[The Zen of Python (pep 20)](https://www.python.org/dev/peps/pep-0020/)
```
Beautiful is better than ugly.
Explicit is better than implicit.
Simple is better than complex.
Complex is better than complicated.
Flat is better than nested.
Sparse is better than dense.
Readability counts.
Special cases aren't special enough to break the rules.
Although practicality beats purity.
Errors should never pass silently.
Unless explicitly silenced.
In the face of ambiguity, refuse the temptation to guess.
There should be one-- and preferably only one --obvious way to do it.
Although that way may not be obvious at first unless you're Dutch.
Now is better than never.
Although never is often better than *right* now.
If the implementation is hard to explain, it's a bad idea.
If the implementation is easy to explain, it may be a good idea.
Namespaces are one honking great idea -- let's do more of those!
```

When in doubt, ask.

### Static Analysis

[Coala](https://coala.io/#/home) is used to perform static analysis of the Mauka code base. Coala utilizes a plugin architecture to wrap several linters for Python (and other) code bases.

See https://github.com/coala/bear-docs/blob/master/README.rst#python to find information about linters that are supported for Python.

Static code analysis in Mauka is controlled by the .coafile at [opq/mauka/.coafile](https://github.com/openpowerquality/opq/blob/master/mauka/.coafile) 

To perform static code analysis ensure that coala is installed. Change to the `mauka` directory and invoke `coala --ci`. This will load the .coafile settings, run the linters, and display any errors tha the linters find. The following is an example of such a run.

```
anthony:~/Development/opq/mauka [12:28:11 Tue Jul 03]
> coala --ci
Executing section mauka...
Executing section mauka.spacing...
Executing section mauka.pep8...
Executing section mauka.pylint...
Executing section mauka.pyflakes...
Executing section mauka.bandit...
Executing section cli...
```

Here, we can see the different sections and linters running over the Mauka code base. Let's discuss each of the sections in detail.

#### Static Analysis Configuration

Configuration for Mauka's static analysis is performed in the [opq/mauka/.coafile](https://github.com/openpowerquality/opq/blob/master/mauka/.coafile) file.

The `mauka` section sets up ignored files and files that need to be linted. In our case, we want to ignore the auto-generated protobuf files and the tests directory. We want to lint all other files under mauka/ that end with the `.py` extension.

`mauka.spacing` ensures that all whitespace consists of space characters and not tabs.

`mauka.pep8` ensures that the code base conforms to Python pep8 standard. We make one change which is to set max line length to 120 characters.

`mauka.pylint` runs [pylint](https://www.pylint.org/) over the Mauka code base which catches a wide range common style and bug prone code. We disable [C0301](http://pylint-messages.wikidot.com/messages:c0301) since this already checked and configured in the mauka.pep8 linter. We also disable C1801 which disallows the following:

```python
if len(some_collection) == 0:
    # do something
else:
    # do something else    
```

in favor of the more Pythonic

```python
if some_collection:
    # do something
else:
    # do something else
```

which tests if the collection is empty directly using the if statement. This issue with this approach is that this idiom does not work for numpy arrays. These are so prevalent in our code that we decided to use the len(collection) idiom to test for all empty collections since this approach does work with numpy.


`mauka.pyflakes` (https://github.com/PyCQA/pyflakes) performs similar linting to pylint.

`mauka.bandit` performs security checks over the code base. B322 is disabled since it only applies to Python 2 code bases.

## API Documentation

[Mauka API Documentation](/mauka/api_docs/opq_mauka.html)


## Docker

Please see [Building, Publishing, and Deploying OPQ Cloud Services with Docker](cloud-docker.html) for information on packaging up this service using Docker.
