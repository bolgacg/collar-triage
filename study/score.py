"""Score the triage against the two alarms a fleet team would set up first.

Implements PREREGISTRATION.md, including the changes listed at its end. Reads the daily
summaries and the researchers' reference data, writes data/results.json.

usage: python3 study/score.py
"""
import csv, json, math, os, statistics
from collections import defaultdict
from datetime import date, timedelta

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(HERE, "..", "data")
STORK_DAILY = os.path.join(DATA, "storks_daily.csv")
# The researchers' reference data (how each deployment ended), copied from the download so the
# scoring runs from the committed files alone. CC0, from the same Movebank package.
STORK_REF = os.path.join(DATA, "storks_reference.csv")
BUFFALO_DAILY = os.path.join(DATA, "buffalo_daily.csv")

WINDOW = 30          # final window, days, including the last day
LEAD = 2             # a warning must come at least this many days before the last record
BLOCK = WINDOW - LEAD  # 28 eligible days, so healthy running is cut into 28-day blocks
CAUSE_DAYS = 7       # the cause signature is read from the final 7 days
HISTORY = 14         # rules compare a day with the previous 14 days
MIN_HISTORY = 3      # and need at least 3 of them to say anything
TAIL = 45            # days of each silent tag sent to the page
STRICTNESS = sorted(set([round(0.25 * 1.1 ** i, 4) for i in range(0, 40)] + [1.0]))
VOLT_LEVELS = [3400 + 10 * i for i in range(0, 71)]   # 3.40 to 4.10 V
COMBO_LEVEL = 3700   # the exploratory combination: low-battery alarm at 3.70 V plus the stationary rule
RULES = ("T1", "T2", "T3", "T4")


def f(x):
    return float(x) if x not in ("", None) else None


def med(xs):
    xs = [x for x in xs if x is not None]
    return statistics.median(xs) if len(xs) >= MIN_HISTORY else None


def metres(a, b):
    k = math.cos(math.radians((a[0] + b[0]) / 2))
    return 111_320 * math.hypot(b[0] - a[0], (b[1] - a[1]) * k)


def calendar(days):
    """Every calendar day from the first to the last record; missing days carry n = 0."""
    first, last = min(days), max(days)
    out, t = [], first
    while t <= last:
        out.append((t, days.get(t, {"n": 0.0})))
        t += timedelta(days=1)
    return out


# ---------- the rules ----------

def rule_days(series, k):
    """For each calendar day, which triage rules fire at strictness k (1 = preregistered)."""
    cond = {name: [] for name in RULES}
    first_pos, armed, prev_pos = None, False, None
    for i, (t, r) in enumerate(series):
        past = [s for _, s in series[max(0, i - HISTORY):i]]
        has = r.get("n", 0) > 0
        # T1 charge deficit: today's high at least 100k mV below the 14-day median of daily highs
        m = med([p.get("v_max") for p in past])
        c1 = has and r.get("v_max") is not None and m is not None and r["v_max"] <= m - 100 * k
        # T2 reporting drop: fewer records than 0.5^k of the 14-day median; a day without a record counts as zero
        m = med([p.get("n") for p in past])
        c2 = m is not None and m > 0 and r.get("n", 0) < (0.5 ** k) * m
        # T3 GPS loss: no-fix share at least 1 - 0.5^k, or median time to fix at least 2^k times its median and 30k s
        c3 = False
        if has and r["n"] >= 4:
            c3 = (r.get("n_nofix") or 0) / r["n"] >= 1 - 0.5 ** k
            m = med([p.get("ttf_med") for p in past])
            if r.get("ttf_med") is not None and m:
                c3 = c3 or (r["ttf_med"] >= (2 ** k) * m and r["ttf_med"] >= 30 * k)
        # T4 stationary: armed once 2 km from the first fix; 90% of fixes within 25/k m, and within 25/k m of yesterday
        c4 = False
        pos = (r["lat_med"], r["lon_med"]) if has and r.get("lat_med") is not None else None
        if pos:
            first_pos = first_pos or pos
            armed = armed or metres(first_pos, pos) > 2000
            if armed and prev_pos and r.get("spread_m") is not None:
                c4 = r["spread_m"] <= 25 / k and metres(prev_pos, pos) <= 25 / k
            prev_pos = pos
        for name, c in zip(RULES, (c1, c2, c3, c4)):
            cond[name].append(c)
    # T1, T2 and T4 must hold on two days running; T3 is stated for a single day
    return [{name: cond[name][i] and (name == "T3" or (i > 0 and cond[name][i - 1])) for name in RULES}
            for i in range(len(series))]


def low_battery_days(series, level):
    return [r.get("n", 0) > 0 and r.get("v_min") is not None and r["v_min"] < level for _, r in series]


def last_seen_days(series):
    return [r.get("n", 0) == 0 for _, r in series]


# ---------- scoring ----------

def split(n, silent):
    """Healthy days, where any firing is a false alarm, and the days on which a warning counts.

    A silent tag's final window is its last 30 calendar days including the last one; a warning
    counts if it comes at least 2 days before the last record, which leaves 28 eligible days.
    Days before the final window are healthy. Every day of a tag still reporting is healthy.
    """
    if not silent:
        return range(0, n), range(0)
    return range(0, max(0, n - WINDOW)), range(max(0, n - WINDOW), max(0, n - LEAD))


def blocks(healthy):
    """Healthy running cut into whole 28-day blocks, counted from its start."""
    return [range(s, s + BLOCK) for s in range(healthy.start, healthy.stop - BLOCK + 1, BLOCK)]


def score(units, fired):
    """units: list of (n_days, silent); fired: one list of daily booleans per unit."""
    warned = silent_n = false_days = healthy_days = false_blocks = n_blocks = 0
    leads = []
    for (n, silent), fd in zip(units, fired):
        healthy, eligible = split(n, silent)
        healthy_days += len(healthy)
        false_days += sum(1 for i in healthy if fd[i])
        for b in blocks(healthy):
            n_blocks += 1
            false_blocks += any(fd[i] for i in b)
        if silent:
            silent_n += 1
            hits = [i for i in eligible if fd[i]]
            leads.append(n - 1 - hits[0] if hits else None)
            warned += bool(hits)
    return {"warned": warned, "silent": silent_n, "warned_share": warned / silent_n if silent_n else 0.0,
            "false_blocks": false_blocks, "blocks": n_blocks, "false_share": false_blocks / n_blocks if n_blocks else 0.0,
            "false_days": false_days, "healthy_days": healthy_days,
            "false_per_collar_year": 365.25 * false_days / healthy_days if healthy_days else 0.0, "leads": leads}


def strip(p):
    return {k: v for k, v in p.items() if k != "leads"}


def best_within(curve, share):
    """The point of a swept alarm that warns most without flagging more healthy blocks than share."""
    ok = [p for p in curve if p["false_share"] <= share + 1e-12]
    return max(ok, key=lambda p: (p["warned_share"], -p["false_share"])) if ok else None


# ---------- causes ----------

CAUSES = [
    ("stationary", "Stopped moving before it went quiet"),
    ("energy", "Battery or charging ran down"),
    ("gps", "GPS lost its fix"),
    ("reporting", "Reports thinned out, battery fine"),
    ("none", "No warning in any field"),
]


def cause_of(series, fires):
    n = len(series)
    tail = range(max(0, n - CAUSE_DAYS), n)
    last = series[-1][1]
    if any(fires[i]["T4"] for i in tail):
        return "stationary"
    if any(fires[i]["T1"] for i in tail) or (last.get("v_min") is not None and last["v_min"] < 3700):
        return "energy"
    if any(fires[i]["T3"] for i in tail):
        return "gps"
    if any(fires[i]["T2"] for i in tail):
        return "reporting"
    return "none"


ALIVE = ("observed afterwards", "seen alive", "logger failed", "logger failure", "gps failure", "ring reading",
         "bird alive")
DIED = ("died", "dead", "electrocut", "killed", "shot", "hunted", "predat", "euthan", "collision", "drowned")


def field_record(r):
    """What the researchers recorded about the end, read in a fixed order from their own words.

    alive     the comments say the tag failed or the bird was seen after the tag went quiet
    death     a cause or date of death is recorded, or the comments say the bird died
    vanished  the comments say the bird vanished and nothing more is known
    none      nothing is recorded
    """
    text = (r.get("deployment-end-comments", "") + " " + r.get("animal-death-comments", "")).lower()
    if any(w in text for w in ALIVE) and not r.get("animal-mortality-type"):
        return "alive"
    if r.get("animal-mortality-type") or r.get("animal-mortality-date"):
        return "death"
    if "vanish" in text:
        return "vanished"
    if any(w in text for w in DIED):
        return "death"
    return "none"


def recovered(r):
    text = (r.get("deployment-end-comments", "") + " " + r.get("animal-death-comments", "")).lower()
    neg = ("not found", "not yet found", "no logger found", "no logger or other traces", "without logger")
    return any(w in text for w in ("logger found", "logger has been found", "logger retrieved", "tag retrieved",
                                    "logger and carcass", "carcass and logger", "logger, carcass")) \
        and not any(w in text for w in neg)


# ---------- the stork study ----------

def load_storks():
    ref = {}
    with open(STORK_REF, newline="") as fh:
        for r in csv.DictReader(fh):
            ref[(r["tag-id"], r["animal-id"].casefold())] = r
    tags = defaultdict(dict)
    with open(STORK_DAILY, newline="") as fh:
        for r in csv.DictReader(fh):
            row = {k: f(r[k]) for k in ("n", "n_fix", "n_nofix", "v_max", "v_min", "v_mean", "fv_min", "ttf_med",
                                         "ttf_max", "temp_min", "temp_max", "temp_mean", "lat_med", "lon_med", "spread_m")}
            tags[(r["tag"], r["animal"])][date.fromisoformat(r["day"])] = row
    return tags, ref


def storks():
    tags, ref = load_storks()
    cutoff = max(max(days) for days in tags.values())
    keys = sorted(tags)
    series = [calendar(tags[k]) for k in keys]
    silent = [s[-1][0] < cutoff - timedelta(days=WINDOW) for s in series]
    meta = [ref.get((k[0], k[1].casefold()), {}) for k in keys]
    units = [(len(s), q) for s, q in zip(series, silent)]

    # the sweep keeps only each setting's score; the rules themselves are kept at the preregistered setting
    triage = [dict(strip(score(units, [[any(d.values()) for d in rule_days(s, k)] for s in series])), k=k)
              for k in STRICTNESS]
    fires1 = [rule_days(s, 1.0) for s in series]
    any1 = [[any(d.values()) for d in fs] for fs in fires1]
    battery = [dict(strip(score(units, [low_battery_days(s, lv) for s in series])), level=lv) for lv in VOLT_LEVELS]
    last_seen = score(units, [last_seen_days(s) for s in series])

    op_full = score(units, any1)
    op = dict(strip(op_full), k=1.0)
    matched = best_within(battery, op["false_share"])
    matched_full = score(units, [low_battery_days(s, matched["level"]) for s in series])
    single = {name: strip(score(units, [[d[name] for d in fs] for fs in fires1])) for name in RULES}
    combo_fd = [[a or d["T4"] for a, d in zip(low_battery_days(s, COMBO_LEVEL), fs)]
                for s, fs in zip(series, fires1)]
    combo = strip(score(units, combo_fd))
    combo_matched = best_within(battery, combo["false_share"])

    # which tags each alarm warned, and how far ahead
    tri_leads, bat_leads = op_full["leads"], matched_full["leads"]
    both = sum(1 for a, b in zip(tri_leads, bat_leads) if a is not None and b is not None)
    either = sum(1 for a, b in zip(tri_leads, bat_leads) if a is not None or b is not None)

    endings, cross, first_rule = [], defaultdict(lambda: defaultdict(int)), defaultdict(int)
    si = 0
    for s, q, r, k, fs in zip(series, silent, meta, keys, fires1):
        if not q:
            continue
        n = len(s)
        cause = cause_of(s, fs)
        rec = field_record(r)
        cross[cause][rec] += 1
        healthy, eligible = split(n, True)
        hit = next((i for i in eligible if any(fs[i].values())), None)
        if hit is not None:
            for name in RULES:
                if fs[hit][name]:
                    first_rule[name] += 1
        tail = list(range(max(0, n - TAIL), n))
        low = low_battery_days(s, matched["level"])
        endings.append({
            "tag": k[0], "animal": k[1], "cause": cause, "record": rec, "recovered": recovered(r),
            "mortality": r.get("animal-mortality-type", ""), "mortality_date": r.get("animal-mortality-date", "")[:10],
            "end_comment": r.get("deployment-end-comments", ""), "death_comment": r.get("animal-death-comments", ""),
            "end_type": r.get("deployment-end-type", ""), "stage": r.get("animal-life-stage", ""),
            "first": s[0][0].isoformat(), "last": s[-1][0].isoformat(), "days": n,
            "lead": tri_leads[si], "lead_battery": bat_leads[si],
            "tail": [{"d": n - 1 - i, "n": int(s[i][1].get("n", 0)), "vmax": s[i][1].get("v_max"),
                      "vmin": s[i][1].get("v_min"), "nofix": int(s[i][1].get("n_nofix") or 0),
                      "ttf": s[i][1].get("ttf_med"), "spread": s[i][1].get("spread_m"),
                      "fires": [nm for nm in RULES if fs[i][nm]], "low": low[i]}
                     for i in tail],
        })
        si += 1

    return {
        "cutoff": cutoff.isoformat(), "first_day": min(s[0][0] for s in series).isoformat(),
        "tags": len(series), "silent": sum(silent), "still": len(series) - sum(silent),
        "collar_years": round(sum(len(s) for s in series) / 365.25, 1),
        "healthy_blocks": op["blocks"],
        "triage": triage, "battery": battery, "last_seen": strip(last_seen),
        "op": op, "matched": matched, "single": single,
        "combo": dict(combo, level=COMBO_LEVEL), "combo_matched": combo_matched,
        "overlap": {"both": both, "either": either},
        "first_rule": dict(first_rule),
        "causes": CAUSES, "cross": {c: dict(v) for c, v in cross.items()},
        "deaths": sum(1 for e in endings if e["record"] == "death"), "endings": endings,
    }


# ---------- the buffalo herd ----------

def buffalo():
    days = defaultdict(dict)
    with open(BUFFALO_DAILY, newline="") as fh:
        for r in csv.DictReader(fh):
            row = {k: f(r[k]) for k in ("n", "n_fix", "n_nofix", "n_away", "temp_min", "temp_max", "temp_mean",
                                         "lat_med", "lon_med", "spread_m")}
            days[r["collar"]][date.fromisoformat(r["day"])] = row
    end = max(max(d) for d in days.values())
    collars = {}
    for c, d in days.items():
        # service starts on the first day with a fix at the site, so a collar in transit is not counted
        start = min(t for t, r in d.items() if (r["n_fix"] or 0) > 0)
        collars[c] = calendar({t: r for t, r in d.items() if t >= start})
    # the herd on each day: median messages over the collars in service that day, a silent day counting as zero
    herd, t = {}, min(s[0][0] for s in collars.values())
    lookup = {c: dict(s) for c, s in collars.items()}
    while t <= end:
        counts = [lookup[c][t]["n"] for c, s in collars.items() if s[0][0] <= t <= s[-1][0]]
        herd[t] = statistics.median(counts) if counts else None
        t += timedelta(days=1)
    out = []
    for c, s in sorted(collars.items()):
        fs = rule_days(s, 1.0)
        own = [d["T2"] for d in fs]
        rel_c = [bool(herd[t]) and r.get("n", 0) < 0.5 * herd[t] for t, r in s]
        rel = [rel_c[i] and i > 0 and rel_c[i - 1] for i in range(len(s))]
        n = len(s)
        early = s[-1][0] <= end - timedelta(days=3)

        def lead(xs):
            return next((n - 1 - i for i in range(max(0, n - 14), max(0, n - LEAD)) if xs[i]), None)

        def talking(xs):
            """Whether the first firing came on a day the collar still sent messages."""
            i = next((i for i in range(max(0, n - 14), max(0, n - LEAD)) if xs[i]), None)
            return None if i is None else s[i][1].get("n", 0) > 0

        spreads = [r["spread_m"] for _, r in s if r.get("spread_m") is not None]
        out.append({
            "collar": c, "first": s[0][0].isoformat(), "last": s[-1][0].isoformat(), "early": early,
            "days": [{"day": t.isoformat(), "n": int(r.get("n", 0)), "herd": herd[t], "nofix": int(r.get("n_nofix") or 0),
                      "tmin": r.get("temp_min"), "own": own[i], "rel": rel[i]} for i, (t, r) in enumerate(s)],
            "own_lead": lead(own) if early else None, "rel_lead": lead(rel) if early else None,
            "own_talking": talking(own) if early else None, "rel_talking": talking(rel) if early else None,
            "own_false_days": 0 if early else sum(own), "rel_false_days": 0 if early else sum(rel),
            "stationary_days": sum(d["T4"] for d in fs), "nofix_msgs": sum(int(r.get("n_nofix") or 0) for _, r in s),
            "spread_median": statistics.median(spreads) if spreads else None,
        })
    full = [x for x in out if not x["early"]]
    return {
        "start": min(x["first"] for x in out), "end": end.isoformat(), "collars": out,
        "n_collars": len(out), "n_early": sum(x["early"] for x in out),
        "own_warned": sum(1 for x in out if x["early"] and x["own_lead"] is not None),
        "rel_warned": sum(1 for x in out if x["early"] and x["rel_lead"] is not None),
        "own_warned_talking": sum(1 for x in out if x["early"] and x["own_talking"]),
        "rel_warned_talking": sum(1 for x in out if x["early"] and x["rel_talking"]),
        "own_false_days": sum(x["own_false_days"] for x in full), "rel_false_days": sum(x["rel_false_days"] for x in full),
        "full_collar_days": sum(len(x["days"]) for x in full),
        "stationary_days": sum(x["stationary_days"] for x in out),
        "spread_median": statistics.median([x["spread_median"] for x in out if x["spread_median"] is not None]),
        "herd": [{"day": t.isoformat(), "median": m} for t, m in sorted(herd.items())],
    }


def main():
    out = {"storks": storks(), "buffalo": buffalo()}
    with open(os.path.join(DATA, "results.json"), "w") as fh:
        json.dump(out, fh, indent=1, default=str)
    s, b = out["storks"], out["buffalo"]
    op, m, c, cm = s["op"], s["matched"], s["combo"], s["combo_matched"]
    print(f"{s['tags']} tags, {s['silent']} silent, {s['still']} still reporting, {s['collar_years']} collar-years, "
          f"{s['healthy_blocks']} healthy blocks")
    print(f"triage k=1: warned {op['warned']}/{op['silent']}, healthy blocks flagged {op['false_share']:.0%}, "
          f"{op['false_per_collar_year']:.1f} days per collar-year")
    print(f"low battery at {m['level']} mV: warned {m['warned']}/{m['silent']}, blocks flagged {m['false_share']:.0%}, "
          f"{m['false_per_collar_year']:.1f} days per collar-year")
    print("single rules:", {k: (v["warned"], round(v["false_share"], 3)) for k, v in s["single"].items()})
    print(f"last seen: warned {s['last_seen']['warned']}, blocks flagged {s['last_seen']['false_share']:.0%}")
    print(f"combo: warned {c['warned']}, blocks {c['false_share']:.0%}; battery alone at that budget "
          f"({cm['level']} mV): warned {cm['warned']}, blocks {cm['false_share']:.0%}")
    print("overlap:", s["overlap"], "first rule:", s["first_rule"])
    print("causes x record:", json.dumps(s["cross"]), "deaths", s["deaths"])
    print(f"buffalo: {b['n_collars']} collars, {b['n_early']} stopped early; own-history warned {b['own_warned']}, "
          f"herd-relative warned {b['rel_warned']}; false days own {b['own_false_days']} rel {b['rel_false_days']} "
          f"of {b['full_collar_days']}; stationary days {b['stationary_days']}; median daily spread {b['spread_median']} m")
    for x in b["collars"]:
        if x["early"]:
            print("  ", x["collar"], x["last"], "own lead", x["own_lead"], x["own_talking"], "rel lead", x["rel_lead"],
                  x["rel_talking"], "nofix", x["nofix_msgs"])


if __name__ == "__main__":
    main()
