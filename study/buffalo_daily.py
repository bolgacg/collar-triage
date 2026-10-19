"""One row per buffalo collar per day, from the NATMed spreadsheet.

The file has one row per message: time, collar, latitude, longitude, temperature. Three kinds
of message are counted apart:
  fix      a position within 20 km of the herd's median position
  no fix   the placeholder position the collar sends without a GPS fix (latitude 1.0039, longitude 0)
  away     a real position far from the site, which is a collar in transit before it was fitted

usage: python3 study/buffalo_daily.py <data.xlsx> <out.csv>
"""
import csv, math, statistics, sys
from collections import defaultdict

import openpyxl

FIELDS = ["collar", "day", "n", "n_fix", "n_nofix", "n_away", "temp_min", "temp_max", "temp_mean",
          "lat_med", "lon_med", "spread_m", "first", "last"]


def metres(lat1, lon1, lat2, lon2):
    k = math.cos(math.radians((lat1 + lat2) / 2))
    return 111_320 * math.hypot(lat2 - lat1, (lon2 - lon1) * k)


def main(src, out):
    ws = openpyxl.load_workbook(src, read_only=True).worksheets[0]
    rows = []
    for i, r in enumerate(ws.iter_rows(values_only=True)):
        if i == 0:
            assert r[:5] == ("time_stamp", "id_collar", "lat", "lng", "temperature"), r
            continue
        if r[0] is None:
            continue
        rows.append((r[0], r[1], r[2], r[3], r[4]))
    real = [(la, lo) for _, _, la, lo, _ in rows if la is not None and abs(la - 1.00390631) > 1e-6]
    site = (statistics.median(p[0] for p in real), statistics.median(p[1] for p in real))
    days = defaultdict(lambda: {"n": 0, "n_fix": 0, "n_nofix": 0, "n_away": 0, "temp": [], "pos": [], "ts": []})
    for ts, collar, la, lo, temp in rows:
        d = days[(collar, ts.strftime("%Y-%m-%d"))]
        d["n"] += 1
        d["ts"].append(ts)
        if temp is not None:
            d["temp"].append(float(temp))
        if la is None or (abs(la - 1.00390631) < 1e-6 and lo == 0):
            d["n_nofix"] += 1
        elif metres(site[0], site[1], la, lo) > 20_000:
            d["n_away"] += 1
        else:
            d["n_fix"] += 1
            d["pos"].append((la, lo))
    with open(out, "w", newline="") as f:
        w = csv.DictWriter(f, FIELDS)
        w.writeheader()
        for (collar, day) in sorted(days):
            d = days[(collar, day)]
            row = {"collar": collar, "day": day, "n": d["n"], "n_fix": d["n_fix"], "n_nofix": d["n_nofix"],
                   "n_away": d["n_away"], "first": min(d["ts"]).isoformat(), "last": max(d["ts"]).isoformat()}
            if d["temp"]:
                row.update(temp_min=min(d["temp"]), temp_max=max(d["temp"]),
                           temp_mean=round(statistics.fmean(d["temp"]), 2))
            if d["pos"]:
                la = statistics.median(p[0] for p in d["pos"])
                lo = statistics.median(p[1] for p in d["pos"])
                dist = sorted(metres(la, lo, a, b) for a, b in d["pos"])
                row.update(lat_med=round(la, 6), lon_med=round(lo, 6), spread_m=round(dist[int(0.9 * (len(dist) - 1))]))
            w.writerow(row)
    print(f"{len(rows):,} messages, {len(days):,} collar-days, site at {site[0]:.4f}, {site[1]:.4f}", file=sys.stderr)


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
