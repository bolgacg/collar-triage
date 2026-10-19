"""Stream Movebank e-obs GPS files into one row per tag per day.

The raw files are several gigabytes of five-minute fixes, so they are read once, row by row,
and only daily summaries are kept: how many records arrived, how many had a valid fix, the
battery voltage with and without the GPS load, the time the receiver needed for a fix, the
tag temperature and how far the tag moved.

usage: python3 study/daily_eobs.py <out.csv> <movebank gps .csv or .csv.zip> [...]
"""
import csv, io, math, statistics, sys, zipfile

FIELDS = ["study", "tag", "animal", "day", "n", "n_fix", "n_nofix", "v_max", "v_min", "v_mean",
          "fv_min", "ttf_med", "ttf_max", "ttf_n60", "temp_min", "temp_max", "temp_mean",
          "lat_med", "lon_med", "spread_m", "speed_max", "first", "last"]


def open_csvs(path):
    if path.endswith(".zip"):
        z = zipfile.ZipFile(path)
        for info in z.infolist():
            if info.filename.endswith(".csv") and "__MACOSX" not in info.filename:
                yield io.TextIOWrapper(z.open(info), encoding="utf-8", newline="")
    else:
        yield open(path, encoding="utf-8", newline="")


def num(s):
    try:
        return float(s)
    except ValueError:
        return None


class Day:
    __slots__ = ("n", "n_fix", "n_nofix", "v", "fv", "ttf", "temp", "lat", "lon", "speed", "first", "last")

    def __init__(self):
        self.n = self.n_fix = self.n_nofix = 0
        self.v, self.fv, self.ttf, self.temp, self.lat, self.lon, self.speed = [], [], [], [], [], [], []
        self.first = self.last = None


def metres(lat1, lon1, lat2, lon2):
    k = math.cos(math.radians((lat1 + lat2) / 2))
    return 111_320 * math.hypot(lat2 - lat1, (lon2 - lon1) * k)


def summarise(key, d):
    study, tag, animal, day = key
    row = dict(study=study, tag=tag, animal=animal, day=day, n=d.n, n_fix=d.n_fix, n_nofix=d.n_nofix,
               first=d.first, last=d.last)
    if d.v:
        row.update(v_max=max(d.v), v_min=min(d.v), v_mean=round(statistics.fmean(d.v)))
    if d.fv:
        row["fv_min"] = min(d.fv)
    if d.ttf:
        row.update(ttf_med=statistics.median(d.ttf), ttf_max=max(d.ttf), ttf_n60=sum(t >= 60 for t in d.ttf))
    if d.temp:
        row.update(temp_min=min(d.temp), temp_max=max(d.temp), temp_mean=round(statistics.fmean(d.temp), 1))
    if d.lat:
        la, lo = statistics.median(d.lat), statistics.median(d.lon)
        dist = sorted(metres(la, lo, a, b) for a, b in zip(d.lat, d.lon))
        row.update(lat_med=round(la, 6), lon_med=round(lo, 6), spread_m=round(dist[int(0.9 * (len(dist) - 1))]))
    if d.speed:
        row["speed_max"] = max(d.speed)
    return row


def main(out, paths):
    open_day = {}      # tag key -> (day key, Day): only the current day of each tag is held
    done = {}          # day key -> summary row
    repeats = 0
    rows = 0

    def close(key, d):
        nonlocal repeats
        if key in done:  # the file revisited a day already closed; keep the larger part
            repeats += 1
            if d.n <= done[key]["n"]:
                return
        done[key] = summarise(key, d)

    for path in paths:
        for f in open_csvs(path):
            for r in csv.DictReader(f):
                rows += 1
                if rows % 2_000_000 == 0:
                    print(f"{rows:,} rows, {len(done):,} tag-days", file=sys.stderr, flush=True)
                if r.get("visible", "true") == "false":
                    continue
                ts = r["timestamp"]
                tkey = (r["study-name"], r["tag-local-identifier"], r["individual-local-identifier"])
                key = tkey + (ts[:10],)
                cur = open_day.get(tkey)
                if cur is None or cur[0] != key:
                    if cur is not None:
                        close(*cur)
                    cur = open_day[tkey] = (key, Day())
                d = cur[1]
                d.n += 1
                d.first = ts if d.first is None or ts < d.first else d.first
                d.last = ts if d.last is None or ts > d.last else d.last
                lat, lon = num(r["location-lat"]), num(r["location-long"])
                status = r.get("eobs:status", "")
                if lat is not None and lon is not None and status in ("A", ""):
                    d.n_fix += 1
                    d.lat.append(lat)
                    d.lon.append(lon)
                elif status == "D" or lat is None:
                    d.n_nofix += 1
                for col, bucket in (("eobs:battery-voltage", d.v), ("eobs:fix-battery-voltage", d.fv),
                                    ("eobs:used-time-to-get-fix", d.ttf), ("eobs:temperature", d.temp),
                                    ("ground-speed", d.speed)):
                    x = num(r.get(col, ""))
                    if x is not None:
                        bucket.append(x)
    for cur in open_day.values():
        close(*cur)
    print(f"{rows:,} rows read, {len(done):,} tag-days, {repeats} days revisited out of order", file=sys.stderr)
    with open(out, "w", newline="") as f:
        w = csv.DictWriter(f, FIELDS)
        w.writeheader()
        for key in sorted(done):
            w.writerow(done[key])


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2:])
