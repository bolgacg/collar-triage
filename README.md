# Which tags went quiet, and could their own data have said so?

A field failure study on public tracking collar data. It asks whether the housekeeping data a
solar GPS collar already sends (battery voltage, GPS fix success, time to fix, messages per day,
movement) could have warned that the collar was about to stop, earlier than a plain low battery
alarm, and whether it shows why each collar stopped.

Live page: https://bolgacg.github.io/collar-triage/

The short answer is no on the first question. Four rules fixed before the data was read warned
41 of 101 tags that went quiet, and a single voltage threshold set to the same false alarm rate
warned 40, with its level chosen on the same data. One rule on its own, "stopped moving", is worth keeping; the GPS rule is no better
than chance; and 55 of the 101 endings show no sign in any field, so only the unit itself can
explain them. The page says all of this on its first screen.

It is public research data and describes no company's hardware.

## What is here

| Path | What it does |
|---|---|
| `PREREGISTRATION.md` | The rules and the scoring, written and committed before the daily data was opened (commit 26340c5), and every change since with its date and reason |
| `study/fetch.py` | Downloads the two public datasets into `data/raw/` (about 510 MB, not committed) |
| `study/daily_eobs.py` | Streams the stork tags' GPS rows into one row per tag per day, keeping the 12.8 million the data owners did not flag as outliers |
| `study/buffalo_daily.py` | The same for the buffalo collars |
| `study/score.py` | Runs the alarms over every day of every tag, scores them, writes `data/results.json` |
| `study/build_page_data.py` | Writes `docs/data.js` and fills every number into `docs/index.html` from `docs/template.html` |
| `study/verify_page.js` | Renders the page headless at four widths, checks for script errors and overflow, walks the tour |
| `study/check_copy.js` | Reads every visible string, including chart labels, for dashes and banned phrasing |
| `data/storks_daily.csv`, `data/buffalo_daily.csv`, `data/storks_reference.csv` | The daily summaries and the researchers' record of how each deployment ended, so the scoring can be rerun without the download |
| `docs/` | The page |

## Running it

```
pip install openpyxl
python3 study/fetch.py
python3 study/daily_eobs.py data/storks_daily.csv data/raw/storks/*-gps-*.csv.zip   # about 20 minutes
python3 study/buffalo_daily.py "data/raw/buffalo/NATMed_GPS tracking and temperature data from water buffalo.xlsx" data/buffalo_daily.csv
python3 study/score.py
python3 study/build_page_data.py
node study/verify_page.js
```

The daily summaries are committed, so `score.py` and `build_page_data.py` run on their own in
under a minute.

## Sources

- Fiedler W, Hilsendegen C, Reis C, Lehmann J, Hilsendegen P, Schmidt H, Wikelski M (2024).
  Data from: Study "LifeTrack White Stork Rheinland-Pfalz" (2015-2023). Movebank Data
  Repository. https://doi.org/10.5441/001/1.4192t2j4_2. CC0 1.0.
- University of Western Macedonia, NATMed PRIMA project (2026). NATMed: GPS tracking and
  temperature data from water buffalo (Bubalus bubalis) collars at Lake Chimaditida, Greece
  (June to October 2025). Zenodo. https://doi.org/10.5281/zenodo.19627348. CC BY 4.0.
- Hofman MPG and others (2019). Right on track? Performance of satellite telemetry in terrestrial
  wildlife research. PLOS ONE 14(5): e0216223. https://doi.org/10.1371/journal.pone.0216223. CC0.

The code is MIT licensed. The data keeps the licence its owners gave it.

I built this with Claude, an AI coding assistant. The question, the rules and the conclusions
are mine.

Bolgaç Gülen, October 2026.
