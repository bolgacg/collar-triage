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

1. 19 October, first run. Three deployments did not join to the reference data because the
   animal name differs only in letter case between the two files ("SÜWE" and "Süwe"). The join
   now ignores case. No other join changed.

2. 19 October, first run. The preregistered result, exactly as scored above: at the
   preregistered setting the triage warned 41 of 101 silent tags at 35.0 false alarm days per
   collar-year; the low-battery alarm at the same budget (3.82 V) warned 40 of 101 at 34.9. By
   the first criterion under "What would count against the page", the triage adds nothing.

3. 19 October, first run. The false alarm unit is changed from days to 28-day collar-blocks.
   Counted in days, a random alarm at the same rate would have warned 93 percent of silent tags,
   far above every rule. That is an artefact of the unit, not a finding: a random alarm spreads
   its days over every collar, while a real rule bunches them on the few collars going through
   a bad spell, so the random alarm touches every final window. The page therefore counts, for
   every 28-day block of healthy running, whether it got at least one false alarm, which is
   the same question asked of a silent tag's 28 eligible days. A random alarm then lies on the
   diagonal. The rules, thresholds and warning definition are unchanged, and the day counts are
   still reported on the page. Under the new unit the tie stands: 41 of 101 against 40 of 101 at
   30 percent of healthy blocks flagged.

4. 19 October, first run. Each rule is also scored on its own at the preregistered setting,
   and one combination is tried: the low-battery alarm at 3.70 V together with the stationary
   rule. Both were chosen after seeing the first run, so the page labels them as exploration and
   as a hypothesis for the next fleet, not as a result.

5. 19 October, first run. The 30-day definition of a silent tag does not fit the buffalo study,
   which lasts only 4.7 months. The buffalo collars are described one by one, not scored, and a
   rule that compares each collar with the rest of the herd on the same day is exploration.

6. 19 October, after reading the researchers' free-text comments. The preregistration checked
   each ending against three records: a recorded death, a logger found, or nothing. The
   structured death fields turned out to miss deaths the comments describe ("Electrocuted ca.
   2016-08-07 near Biebesheim"), and six comments say the tag failed while the bird lived on
   ("Logger failure after April 2022. Bird has been observed afterwards."). The record is now
   read from the researchers' own words by a fixed keyword rule, in this order: the tag failed
   or the bird was seen alive after the tag went quiet; a death is recorded or described; the
   bird vanished; nothing recorded. Whether the logger was recovered is kept as a separate flag.
   The rule is in study/score.py, and the page prints each tag's comment beside its class so it
   can be checked by eye.

7. 22 October, after publication. The researchers' reference data is now copied into
   data/storks_reference.csv, so the scoring runs from the committed files alone; before, it was
   read from the uncommitted download folder. No rule, threshold or number changed: a clean clone
   rebuilds docs/index.html and docs/data.js byte for byte. On the same day the page stopped
   comparing the two alarms on the six confirmed tag failures, because six tags cannot carry a
   comparison, and it now says that the low-battery alarm's level was chosen on the same data it
   is scored on.
