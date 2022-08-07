---
title: OPQ Data Model
sidebar_label: Data Model
---

At the core of the OPQ system lies a centralized MongoDB database. The majority of this data is managed by the OPQMauka and OPQMakai systems, though some of it (Locations, Regions, Users) is managed by OPQ View, and the Health collection is managed by the Health process.

The set of MongoDB collections and their relationships constitutes the OPQ Data Model. Here's an overview of the collections:

| Collection | Description |
|------------|-------------|
| box_events | High-fidelity data associated with a single box. |
| BoxOwners | A bi-directional mapping from OPQ Boxes to the Users that have an "ownership" role on them. |
| events | High fidelity data (potentially across multiple boxes) when measurement values trigger further data collection. |
| fs.files, fs.chunks | Implements [GridFS](https://docs.mongodb.com/manual/core/gridfs/) for storage of binary waveform data. |
| health | Timestamped data indicating if OPQ Boxes and services appear to be running. |
| locations | Definitions for locations in terms of latitude and longitude. |
| measurements | Short term, low fidelity OPQBox data. |
| opq_boxes | Information about individual OPQBoxes, such as its current (and prior) locations. |
| regions | Implements aggregations of locations and regions. |
| system_stats | Timestamped documents with near-real time information about the state of the system. |
| trends | Long term, aggregated OPQBox trend data. |
| UserProfiles | Information about users: username, first and last name, and role (user or admin). |


## Naming Conventions

The OPQ system is comprised of a multitude of different tools, libraries, and frameworks.  In order to minimize confusion, we mostly follow a basic set of naming conventions for our collections and documents that we feel will keep things as simple as possible:

* All collection names and documents fields are in lower-case
* Collection names should always be plural
* Use underscores over camel-case to separate words

## Box Events

The box_events collection provides the event meta-data for a given OPQBox.

As an event can be associated with multiple OPQBoxes, it is therefore important to understand that there can be (and often are) multiple box_event documents with the same event_id.

Query on the event_id and box_id fields to find data for a given OPQBox for a specific event.


| Field | Type | Description |
|-------|------|-------------|
| event_id | Integer | The event_id generated by an events document. |
| box_id | String | The OPQBox from which this data was produced. |
| event_start_timestamp_ms | Integer | Unix timestamps indicating the requested start time for the high fidelity data. |
| event_end_timestamp_ms | Integer | Unix timestamps indicating the requested end time for the high fidelity data. |
| window_timestamps_ms | [Integer] | An array of Unix timestamps that correlate with every 2000 samples (10 grid cycles) of recorded box data. This can be useful for debugging purposes, as we can determine the continuity of box data. |
| location | String | Location slug see [Location](#location) for details. |
| data_fs_filename | String | Indicates the GridFS filename that holds the box_event's actual raw waveform data. |

Supplemental indexing: event_start_time_ms and box_id form a unique composite index.

## Box Owners

The BoxOwners collection provides a bi-directional mapping between OPQ Boxes and the users who have ownership over them.

| Field | Type | Description |
|-------|------|-------------|
| username | String | The box owner's username (email address). |
| boxId | String | The Box owned by this user. A string such as "1", "2" etc. Not the documentID! |

Supplemental indexing: none.

## Events

The events collection provides access to high fidelity waveform data that was retrieved from OPQ Boxes in response to non-nominal measurements.

| Field | Type | Description |
|-------|------|-------------|
| event_id | Integer | A unique integer value generated for each event. |
| description | String | Indicates additional information about the event |
| boxes_triggered | [String] | A list of all OPQBoxes associated with the given event - however it is important to note that this does not always correspond to all of the OPQBoxes for which we have received actual data from for the event. |
| boxes_received | [String] | List of all OPQBoxes from which high fidelity data was received for the event |
| latencies_ms | [Integer] | an array of timestamps (milliseconds since epoch) indicating the time when data from each OPQBox was received. Maintains a 1 to 1 correlation with boxes_received. |
| target_event_start_timestamp_ms | Integer | Unix timestamps indicating the requested start time for the high fidelity data. |
| target_event_end_timestamp_ms | Integer | Unix timestamps indicating the requested end time for the high fidelity data |

Supplemental indexing: event_id is a unique index, target_event_start_time_ms is an index.

## fs.files, fs.chunks

[GridFS](https://docs.mongodb.com/manual/core/gridfs/) is a MongoDB specification for storing large documents. As an OPQBox can collect a very large amount of data for each given event (often exceeding the 16 MB MongoDB document size limit), we've opted to utilize GridFS to store our high-fidelity data.

At its core, GridFS is a very simple system consisting of two collections, fs.files and fs.chunks.

The fs.files collection stores file metadata:

| Field | Type | Description |
|-------|------| ------------|
| filename | String | Generated by GridFS, corresponds to the box_event's data_fs_filename field, |
| length | Integer |  Generated by GridFS |
| chunkSize | Integer |  Generated by GridFS |
| uploadDate | Date |  Generated by GridFS |
| md5 | String |  Generated by GridFS |
| metadata.event_id | Integer | Added by Makai, used to find the corresponding box_event document. |
| metadata.box_id | String | Added by Makai, used to find the corresponding box_event document. |
| metadata.incident_id | String | Added by Mauka, used to find the corresponding incident document. |

Supplemental indexing: none

Note: The GridFS specification requires the metadata field be used to store any external information for the given file document. See [GridFS files.metadata](https://docs.mongodb.com/manual/core/gridfs/#files.metadata)  for more information.

The fs.chunks collection has the following structure:

| Field | Type | Description |
|-------|------| ------------|
| files_id | ObjectId| Object ID. |
| n | Integer | Length |
| data | Binary | The data. |

Supplemental indexing: none

## Health

The OPQ Health service creates documents representing its findings on the current health of the system with the following structure:

| Field | Type | Description |
|-------|------| ------------|
| timestamp | Date  | Each entry has a timestamp, which is a UTC string indicating the time at which the entry was generated. |
| service  | String | Indicates the OPQ Service whose status is being described in this entry.  Service should be one of the following: "box", "mauka", "makai", "view", "mongodb" and "health".  Yes, OPQHealth reports on its own health!   |
| serviceID | String | For some services, such as "box", additional identifying information is required.  The serviceID field provides that information. In the case of OPQBoxes, the serviceID field provides the boxID. |
| status | String | Status is either "up" or "down". |
| info | String  | Info is an optional field that can be used by OPQHealth to provide additional information about an entry. |

Supplemental indexing: timestamp.

## Incidents

**The Incident entity is under construction and not yet available.**

The incidents collection contains documents that classify one or more events. An incident represents a deviation from nominal values for either frequency, voltage, or THD that has been classified.

| Field  | Type  | Description  |
|--------|-------|--------------|
| incident_id | Integer | A unique integer representing the incident |
| event_id | String | Event id |
| box_id | String   | Box id       |
| start_timestamp_ms | Integer | Start of the incident (ms since epoch) |
| end_timestamp_ms | Integer | End of the incident (ms since epoch) |
| location | String | Location slug |
| measurement_type | String | One of [VOLTAGE, FREQUENCY, THD, or TRANSIENT] |
| deviation_from_nominal | Float | Absolute value of measurement deviation from nominal |
| measurements | [Measurement] | Copied from event |
| gridfs_filename | String | Filename of trimmed waveform copied from event |
| classifications | [Classification] | List of classifications that can be applied to incident (see table below)|
| ieee_duration | String | A string indicating one of the standard IEEE durations associated with this incident (see table below) |
| annotations | [Annotation] | List of annotations associated with this incident |
| metadata | Object | Key-Value pairs providing meta-data for this incident |

Supplemental indexing: box_id, location, start_timestamp_ms, measurement_type, classifications


Various organization such as IEEE, ITIC, CBEMA, and SEMI have proposed standardized terminology for classifying power quality deviations. The following two tables cover the classifications based on these standards. Note that the standards overlap, so an incident could have multiple, simultaneous classifications (such as both ITIC_PROHIBITED and VOLTAGE_SWELL, or both SEMI_F47_VIOLATION and VOLTAGE_SAG).  For clarity, we indicate the type of incident and the duration of the incident separately, except in the case of SEMI_F47_VIOLATION, where the durations do not conform to the IEEE categories and so are included in the classication.

| Classification  | Description  |
|--------|--------------|
| EXCESSIVE_THD | Exceeds IEEE 1159 recommendations for THD (5% over 200 ms windows). |
| ITIC_PROHIBITED | Voltage observed in the ITIC prohibited region. |
| ITIC_NO_DAMAGE | Voltage observed in the ITIC no damage region. |
| VOLTAGE_SWELL | Voltage greater than 1.1 pu |
| VOLTAGE_SAG | Voltage between 0.1 - 0.9 pu |
| VOLTAGE_INTERRUPTION | Voltage less than 0.1 pu |
| FREQUENCY_SWELL | Frequency greater than 60.1 Hz |
| FREQUENCY_SAG | Frequency between 58 Hz and 59.9 Hz |
| FREQUENCY_INTERRUPTION | Frequency less than 58 Hz  |
| SEMI_F47_VIOLATION | Voltage observed at 0.5 pu for more than 200ms, 0.7 pu for more than 0.5 seconds, or 0.8 pu for more than 1 second. |

*Note: pu stands for "per unit" and 1pu = nominal. In the U.S. 1pu = 120V.*

The following table classifies the duration according to standard IEEE terminology for durations.   Note that the precise duration of the incident can be determined by subtracting start_timestamp_ms from end_timestamp_ms.

| IEEE Duration  | Description  |
|--------|--------------|
| INSTANTANEOUS | A duration between 0.5 and 30 cycles |
| MOMENTARY | A duration between 30 cycles and 3 seconds |
| TEMPORARY | A duration between 3 seconds and 1 minute |
| SUSTAINED | A duration greater than 1 minute |




## Locations

The locations collection provides entities that define locations that can be associated with OPQ Boxes, Trends, Events, and other entities in the system.

| Field | Type | Description |
|-------|------| ------------|
| slug | String  | A unique, human-friendly string identifier. |
| coordinates | Array | Contains longitude and latitude coordinates in that order. |
| description | String  | A description of the location.  |

Supplemental indexing: slug is a unique index, description is a unique index.

Note that the coordinates array must list longitude first, then latitude. See [this StackOverflow Question](https://stackoverflow.com/questions/15274834/how-to-store-geospatial-information-in-mongodb) for more details. Mongo has great support for [GeoSpatial queries](https://docs.mongodb.com/manual/geospatial-queries/), so this will be fun to have.

Location slugs should be considered *permanent* once defined.  Since these slugs have the potential to appear in other documents throughout the database, you will have to guarantee that the location does not appear anywhere else in the database in order to delete it.

Likewise, you should not change the coordinate values willy-nilly.  Only change them if they incorrectly specify the intended location.

## Measurements

The measurements collection provides low-fidelity OPQBox snapshot data for a specific moment in time. Documents in this collection are produced at a very rapid rate; OPQ Makai requests data from each OPQ Box at a rate of six times per second. As such, each measurement document can essentially be thought of as an OPQBox "heartbeat", providing a timestamp and some additional low-fidelity data. Documents are persisted in the collection for a period of 24 hours before expiring.

| Field | Type | Description |
|-------|------| ------------|
| box_id | String  | The Box ID.  |
| timestamp_ms| Integer  |  The Unix UTC timestamp in milliseconds. |
| voltage | Float  | RMS voltage |
| frequency | Float  | Frequency |
| thd | Float  | Total Harmonic Distortion (over this measurement window) |
| expireAt | Date  | Currently set to 24 hours. |

Supplemental indexing: box_id and timestamp_ms are a unique composite index.

## OPQ Boxes

The opq_boxes collection provides information about each individual OPQBox in the system.

| Field | Type | Description |
|-------|------| ------------|
| box_id | String   | A unique string identifier for the OPQBox. This value is always referenced throughout the data model when we need to store a box_id value within a document. Currently they are strings like "1", "2", "3".  |
| name | String   | A unique user-friendly string identifier for the OPQBox. Unlike the box_id value, which is often used internally throughout the data model, the name value should be thought of as the external representation of the OPQBox. |
| description | String  | Optional:  can be used to further describe an OPQBox. |
| calibration_constant | Float  | A box-specific value that is used to adjust the values returned by the analog-to-digital converter chip so that we get accurate voltage and frequency values.   |
| location |  String |  A location slug that identifies the current location of this box. |
| location_start_time_ms | Integer  | A UTC millisecond time stamp indicating the time that data from the current location began being transmitted.  |
| location_archive | Array  | Contains objects with fields location and location_start_time_ms. This provides a historical record of the locations associated with this box.  |
| public_key | String  | A 32 byte key used for CurveZMQ authentication. |

Supplemental indexing: box_id is a unique index, name is a unique index.

## Regions

“Regions” represent aggregations of Locations. Conceptually, a region consists of a region name along with a list of locations that are included in that region.  This is implemented via a bi-directional table called "regions":

| Field | Type | Description |
|-------|------| ------------|
| regionSlug | String  | The unique identifier for a region. |
| locationSlug | String  | The unique identifer for the location associated with this region. |

Supplemental indexing: none.

Note that regions do not have a "description". Their slug should be self-descriptive, such as a city name (i.e. "Kailua, HI") or zip code (i.e. "96734"). Note that the relationship is many-to-many: a region can be associated with multiple locations, and a location can be associated with multiple regions.

You can create a hierarchy of regions. For example, you can specify 5 locations as being in "96734", and those same 5 locations (as well as many others) can be included in the region named "Hawaii".

Region and location slugs together constitute a single namespace (i.e. you can’t have two locations or two regions both called “96734”, nor can you have a location called “96734" and a region also called “96734”).

## System Stats

The SystemStats collection consists of a single timestamped document which provides "near-real time" information about the state of the system. The goal of the SystemStats collection is to facilitate system scalability: a server-side cron job can update the SystemStats document once every 10 seconds, and then all connected clients will be updated with the revised document that summarizes the most recent state of the system. This is preferable to clients retrieving individual Measurements documents, for example.

| Field | Type | Description |
|-------|------| ------------|
| timestamp | Date  | The time when this data was collected. |
| events_count | Integer  | The total number of events in the database.  |
| events_count_today  | Integer | The total number of events created so far today.  |
| box_events_count | Integer  | The total number of box_events in the database. |
| box_events_count_today | Integer  | The total number of box_events created so far today. |
| measurements_count | Integer  | The total number of measurements in the database. |
| measurements_count_today | Integer  | The total number of measurements created so far today. |
| trends_count | Integer  | The total number of trends in the database. |
| trends_count_today | Integer  | The total number of trends created so far today. |
| opq_boxes_count | Integer  | The total number of opq_boxes in the database. |
| users_count | Integer  | The total number of users.  |
| box_trend_stats | Array  | Each element is an object with fields boxId (the box ID), firstTrend (the timestamp of the earliest trend collected for this box), lastTrend (the timestamp of the most recent trend associated with this box), and totalTrends (the total number of trends associated with this box)  |

Supplemental indexing: none.


## Trends

The **trends** collection provides OPQBox measurements of voltage, frequency, and THD that are persisted indefinitely. Each trend document represents data aggregated over a one minute data collection window for an individual OPQBox.  Trend data is essentially a "roll-up" of the measurement data associated with a box.

| Field | Type | Description |
|-------|------| ------------|
| box_id | String | The box ID.  |
| timestamp_ms | Integer  | The Unix UTC timestamp.   |
| location | String  | The location slug indicating the place this box was located at the time of data collection.  |
| voltage | Object  | An object with fields min, max, and average. Each are floats, representing the voltage values calculated for the minute preceding this timestamp.  |
| frequency | Object  | An object with fields min, max, and average. Each are floats, representing the frequency values calculated for the minute preceding this timestamp.   |
| thd | Object  | An object with fields min, max, and average. Each are floats, representing the THD values calculated for the minute preceding this timestamp.   |

Supplemental indexing: box_id and timestamp_ms are a composite index.

## Users

Users are represented in OPQ by three collections: the Users collection (maintained by Meteor, which provides password and basic account information, which is not shown below), UserProfiles (additional profile information, shown below), and BoxOwners (which provides a two-way mapping between OPQ Boxes and their owner(s), discussed elsewhere on this page).

Here's the UserProfile collection structure:

| Field | Type | Description |
|-------|------| ------------|
| username | String |  The user's username, which is their email address. |
| firstName | String | Their first name. |
| lastName | String | The user's last name.  |
| role | String | Currently, the defined roles are "user" and "admin". |
| phone | String | Their phone number + provider |
| unseen_notifications | Bool | Turns true when user has new notifications they haven't seen yet. |
| notification_preferences | Object | Fields: <br/> - text and email are booleans and represents how user wants to receive notifications. <br/>- max_per_day is a string and represents how often user wants to be sent notifications. It can be set to 'once a day', 'once an hour', or 'never'.  <br/>- notification_types is an array of notification types the user wants to receive. All notification types users can subscribe to are stored in an array in the Notification collection as notificationTypes.|

Supplemental indexing: username is a unique index.

## Notifications

A notification document is created whenever something of interest happens and maps to users that are interested in that particular notification type. Notification documents are removed from db after a week.

Here's the UserProfile collection structure:

| Field | Type | Description |
|-------|------| ------------|
| username | String |The username of the user that is associated with this notification doc |
| type | String | The type of notification. i.e. 'system service down'. UserProfiles collection stores all the notification types a user is subscribed to in an array of strings. |
| timestamp | Date | Time when the notification doc was created.  |
| data | Object | Fields: <br/>- summary is a string that provides additional info about the event that triggered it<br/> More fields to be added as more notification types are added.|
| delivered | Boolean | Turns true once the notification is sent to the user it is associated with. |

In OPQ View, only admins are able to define entities such as users, locations, regions, and OPQ Boxes. Users basically have only "read access" to the data in the system. (This will change in future when we provide the ability for users to annotate events and incidents.)
