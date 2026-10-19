# What was fixed before the data was read

Written 19 October 2026, before any daily summary of the stork tags had been opened. At that
point I had seen only the column names of the stork files, the reference data (how each
deployment ended, as the researchers recorded it), and the daily message counts of six of the
24 buffalo collars while checking that the file could be read. Every change after this point
is listed at the bottom with its date and its reason.

## The question

When an animal-worn tracking collar stops reporting, could its own telemetry have warned
earlier than the two alarms a fleet team would set up first, and does the telemetry say why
it stopped?

## Data

1. Solar GPS-GSM tags (e-obs) on white storks, study "LifeTrack White Stork Rheinland-Pfalz"
   (2015 to 2023), Movebank Data Repository, doi 10.5441/001/1.4192t2j4_2, CC0. These are the
   only public tags found with battery voltage, GPS fix diagnostics and a recorded fate for
   each animal.
2. GPS collars on 24 water buffalo, Lake Chimaditida, Greece, June to October 2025, NATMed
   PRIMA project, Zenodo record 19627348, CC BY 4.0. Livestock collars, but they report only
   position, time and a temperature.

## Units

A tag-day is one UTC calendar day of one tag with at least one record. A tag went silent if
its last record is more than 30 days before the last record in the whole dataset; otherwise it
was still reporting at the cutoff and is not an ending. The final window of a silent tag is
the 30 days before its last record.

## The two alarms a team would set up first

- Last-seen alarm: fires when 24 hours pass without a record. It can only fire after the
  collar has gone quiet, so it never gives warning; it is on the chart as the reference.
- Low-battery alarm: fires on a day whose lowest unloaded battery voltage is below a set level.
  Its level is swept from 3.40 to 4.10 V to draw its curve.

## The triage (fires when any one of these fires)

Each rule uses only that day and earlier days of the same tag.

- T1 charge deficit: the day's highest unloaded battery voltage is at least 100 mV below the
  median of the daily highs over the previous 14 days, on two days running.
- T2 reporting drop: the day's record count is below half the median daily count of the
  previous 14 days, on two days running.
- T3 GPS loss: on a day with at least 4 records, at least half carry no valid fix, or the
  median time to fix is at least twice its 14-day median and at least 30 seconds.
- T4 stationary: once a tag has been more than 2 km from its first fix, it fires when 90
  percent of the day's fixes lie within 25 m of the day's median position, and that median is
  within 25 m of the previous day's, on two days running.

Preregistered setting: exactly the numbers above. To draw a curve, every threshold is scaled
together by one strictness factor; the factor of 1 is the preregistered point and is marked.

## Scoring

- A silent tag counts as warned if a rule fired at least 2 days before its last record and
  within its final window. Lead time is the last record minus the first such firing.
- A false alarm is a firing on a day more than 30 days before a silent tag's last record, or on
  any day of a tag still reporting at the cutoff. The rate is per 100 tag-months of those days.
- The floor is an alarm that fires at random at the same rate: it warns a silent tag with
  probability 1 minus exp(minus rate times the 28 eligible days).

## The causes

Each ending is given the first signature that applies, in this order: stationary before
silence (T4 in the final 7 days), charge deficit or a final-day unloaded voltage below 3.70 V,
GPS loss (T3 in the final 7 days), reporting drop with healthy voltage (T2 in the final 7
days), and otherwise no warning. These are checked against the researchers' own records:
a recorded animal death, a logger found, or nothing recorded.

## What would count against the page

- The triage warns no more silent tags than the low-battery alarm at the same false alarm rate.
- Most endings carry no warning in any field, so telemetry cannot sort them.
- Recorded animal deaths do not show the stationary signature more often than other endings.

Any of these goes in the headline layer if it happens.

## Changes after the data was read

None yet.
