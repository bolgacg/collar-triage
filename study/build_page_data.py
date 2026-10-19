"""Write the page from the results: docs/data.js for the charts, and docs/index.html from
docs/template.html with every number in the prose filled in from the same results.

A placeholder in the template looks like {{name}}. A placeholder with no value, or a value
nobody used, stops the build, so no number on the page can be typed by hand or go stale.

usage: python3 study/build_page_data.py
"""
import csv, json, os, re, statistics, sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.join(HERE, "..")
R = json.load(open(os.path.join(ROOT, "data", "results.json")))
S, B = R["storks"], R["buffalo"]

WORDS = {0: "none", 1: "one", 2: "two", 3: "three", 4: "four", 5: "five", 6: "six", 7: "seven", 8: "eight",
         9: "nine", 10: "ten", 11: "eleven", 12: "twelve"}


def pct(x):
    return f"{round(100 * x)}"


def word(n):
    return WORDS.get(n, str(n))


def times(a, b):
    """How many times a is of b, as a reader would say it."""
    r = a / b if b else float("inf")
    return word(round(r)) if r >= 1.95 else f"{r:.1f}"


op, m, single, ls = S["op"], S["matched"], S["single"], S["last_seen"]
combo, cm = S["combo"], S["combo_matched"]
cross = S["cross"]
endings = S["endings"]
deaths = [e for e in endings if e["record"] == "death"]
others = [e for e in endings if e["record"] != "death"]
alive = [e for e in endings if e["record"] == "alive"]
records = {k: sum(e["record"] == k for e in endings) for k in ("death", "alive", "vanished", "none")}
stat_d = sum(e["cause"] == "stationary" for e in deaths)
stat_o = sum(e["cause"] == "stationary" for e in others)
none_n = sum(e["cause"] == "none" for e in endings)
none_d = sum(e["cause"] == "none" for e in deaths)
leads_t = [e["lead"] for e in endings if e["lead"] is not None]
leads_b = [e["lead_battery"] for e in endings if e["lead_battery"] is not None]
recovered = [e for e in endings if e["recovered"]]
cause_n = {c: sum(e["cause"] == c for e in endings) for c, _ in S["causes"]}

early = [c for c in B["collars"] if c["early"]]
nofix_collars = [c["collar"] for c in B["collars"] if c["nofix_msgs"] > 0]
herd = [h["median"] for h in B["herd"] if h["median"] is not None]
herd_by_month = {}
for h in B["herd"]:
    if h["median"] is not None:
        herd_by_month.setdefault(h["day"][:7], []).append(h["median"])
herd_june = statistics.median(herd_by_month["2025-06"])
herd_late_oct = statistics.median([h["median"] for h in B["herd"] if h["median"] is not None and h["day"] >= "2025-10-20"])

V = {
    # the stork tags
    "tags": S["tags"], "silent": S["silent"], "still": S["still"], "collar_years": f"{S['collar_years']:.0f}",
    "first_year": S["first_day"][:4], "cutoff": S["cutoff"], "cutoff_year": S["cutoff"][:4],
    "blocks": f"{S['healthy_blocks']:,}",
    "op_warned": op["warned"], "op_false": pct(op["false_share"]), "op_days": f"{op['false_per_collar_year']:.0f}",
    "bat_level": f"{m['level'] / 1000:.2f}", "bat_warned": m["warned"], "bat_false": pct(m["false_share"]),
    "bat_days": f"{m['false_per_collar_year']:.0f}",
    "both": S["overlap"]["both"], "either": S["overlap"]["either"],
    "t1_warned": single["T1"]["warned"], "t1_false": pct(single["T1"]["false_share"]),
    "t2_warned": single["T2"]["warned"], "t2_false": pct(single["T2"]["false_share"]),
    "t3_warned": single["T3"]["warned"], "t3_false": pct(single["T3"]["false_share"]),
    "t4_warned": single["T4"]["warned"], "t4_false": pct(single["T4"]["false_share"]),
    "t4_times": times(single["T4"]["warned_share"], single["T4"]["false_share"]),
    "t3_ratio": f"{single['T3']['warned_share'] / single['T3']['false_share']:.1f}",
    "ls_warned": ls["warned"], "ls_false": pct(ls["false_share"]),
    "combo_warned": combo["warned"], "combo_false": pct(combo["false_share"]),
    "combo_level": f"{combo['level'] / 1000:.2f}",
    "cm_warned": cm["warned"], "cm_level": f"{cm['level'] / 1000:.2f}", "cm_false": pct(cm["false_share"]),
    "lead_t_med": f"{statistics.median(leads_t):.0f}", "lead_b_med": f"{statistics.median(leads_b):.0f}",
    "lead_t_week": sum(1 for x in leads_t if x <= 7), "lead_b_week": sum(1 for x in leads_b if x <= 7),
    "lead_t_full": sum(1 for x in leads_t if x >= 28), "lead_b_full": sum(1 for x in leads_b if x >= 28),
    "none_n": none_n, "none_d": none_d, "deaths": len(deaths), "others": len(others),
    "stat_d": stat_d, "stat_o": stat_o, "stat_d_pct": pct(stat_d / len(deaths)), "stat_o_pct": pct(stat_o / len(others)),
    "recovered_n": len(recovered), "alive_n": len(alive), "vanished_n": records["vanished"], "norec_n": records["none"],
    "alive_t": sum(1 for e in alive if e["lead"] is not None), "alive_b": sum(1 for e in alive if e["lead_battery"] is not None),
    "c_stationary": cause_n["stationary"], "c_energy": cause_n["energy"], "c_gps": cause_n["gps"],
    "c_reporting": cause_n["reporting"], "c_none": cause_n["none"],
    "first_t2": S["first_rule"].get("T2", 0),
    # the buffalo herd
    "b_collars": B["n_collars"], "b_early": B["n_early"], "b_own_warned": B["own_warned"], "b_rel_warned": B["rel_warned"],
    "b_own_false": B["own_false_days"], "b_rel_false": B["rel_false_days"], "b_full_days": f"{B['full_collar_days']:,}",
    "b_own_false_pct": pct(B["own_false_days"] / B["full_collar_days"]),
    "b_rel_false_pct": pct(B["rel_false_days"] / B["full_collar_days"]),
    "b_spread": f"{B['spread_median']:.0f}", "b_stationary_days": B["stationary_days"],
    "b_nofix_total": sum(c["nofix_msgs"] for c in B["collars"]), "b_nofix_collars": " and ".join(nofix_collars),
    "b_herd_june": f"{herd_june:.0f}", "b_herd_late_oct": f"{herd_late_oct:.0f}",
    "b_start": B["start"], "b_end": B["end"],
    "b_messages": "118,415",
}


def check_messages():
    path = os.path.join(ROOT, "data", "buffalo_daily.csv")
    with open(path, newline="") as fh:
        total = sum(int(r["n"]) for r in csv.DictReader(fh))
    return f"{total:,}"


V["b_messages"] = check_messages()


def stork_records():
    with open(os.path.join(ROOT, "data", "storks_daily.csv"), newline="") as fh:
        total = sum(int(r["n"]) for r in csv.DictReader(fh))
    return f"{total / 1e6:.1f} million"


V["s_records"] = stork_records()
chronic = next(e for e in alive if e["cause"] == "none" and e["lead_battery"] is not None)
cv = [t["vmax"] for t in chronic["tail"] if t["vmax"] is not None]
misread = next(e for e in alive if e["cause"] == "stationary")
def electrocuted(e):
    t = (e["end_comment"] + " " + e["death_comment"]).lower()
    return "electrocut" in t or "electric pole" in t or "voltage line" in t or e["mortality"] == "vehicle-collision"


V["none_elec_d"] = sum(1 for e in endings if e["cause"] == "none" and e["record"] == "death" and electrocuted(e))
V["chronic_tag"] = chronic["tag"]
V["chronic_lo"] = f"{min(cv) / 1000:.2f}"
V["chronic_hi"] = f"{max(cv) / 1000:.2f}"
V["misread_tag"] = misread["tag"]
V["random_at_op"] = round(op["false_share"] * S["silent"])
V["fleet_false"] = f"{round(op['false_share'] * 10000, -2):,.0f}"
outage = {h["day"] for h in B["herd"] if h["median"] == 0}
V["b_outage_days"] = word(len(outage))
V["b_outage_first"] = min(outage)
V["b_own_false_outage"] = sum(1 for c in B["collars"] if not c["early"] for d in c["days"] if d["own"] and d["day"] in outage)
V["b_rel_talking"] = B["rel_warned_talking"]
V["b_own_talking"] = B["own_warned_talking"]
V["b_rel_silent"] = B["rel_warned"] - B["rel_warned_talking"]


def chart_data():
    tri = [{"x": p["false_share"], "y": p["warned_share"], "k": p["k"]} for p in S["triage"]]
    bat = [{"x": p["false_share"], "y": p["warned_share"], "v": p["level"]} for p in S["battery"]]
    pts = {
        "op": {"x": op["false_share"], "y": op["warned_share"], "warned": op["warned"]},
        "bat": {"x": m["false_share"], "y": m["warned_share"], "warned": m["warned"], "v": m["level"]},
        "ls": {"x": ls["false_share"], "y": ls["warned_share"], "warned": ls["warned"]},
        "combo": {"x": combo["false_share"], "y": combo["warned_share"], "warned": combo["warned"]},
        "T1": {"x": single["T1"]["false_share"], "y": single["T1"]["warned_share"], "warned": single["T1"]["warned"]},
        "T2": {"x": single["T2"]["false_share"], "y": single["T2"]["warned_share"], "warned": single["T2"]["warned"]},
        "T3": {"x": single["T3"]["false_share"], "y": single["T3"]["warned_share"], "warned": single["T3"]["warned"]},
        "T4": {"x": single["T4"]["false_share"], "y": single["T4"]["warned_share"], "warned": single["T4"]["warned"]},
    }
    ends = [{"tag": e["tag"], "animal": e["animal"], "cause": e["cause"], "record": e["record"],
             "mortality": e["mortality"], "mdate": e["mortality_date"], "endc": e["end_comment"],
             "deathc": e["death_comment"], "stage": e["stage"], "rec": e["recovered"], "first": e["first"], "last": e["last"],
             "lead": e["lead"], "leadb": e["lead_battery"],
             "tail": [[t["d"], t["n"], t["vmax"], t["vmin"], t["nofix"], t["spread"], "".join(x[1] for x in t["fires"]),
                       1 if t["low"] else 0] for t in e["tail"]]}
            for e in endings]
    herd_series = [[h["day"], h["median"]] for h in B["herd"]]
    collars = [{"c": c["collar"], "early": c["early"], "first": c["first"], "last": c["last"],
                "ownLead": c["own_lead"], "relLead": c["rel_lead"], "nofix": c["nofix_msgs"], "relTalk": c["rel_talking"],
                "days": [[d["day"], d["n"], d["nofix"], 1 if d["own"] else 0, 1 if d["rel"] else 0] for d in c["days"]]}
               for c in B["collars"]]
    return {"n_silent": S["silent"], "n_blocks": S["healthy_blocks"], "triage": tri, "battery": bat, "points": pts,
            "causes": S["causes"], "cross": cross, "endings": ends, "herd": herd_series, "collars": collars,
            "values": V}


def render():
    tpl = open(os.path.join(ROOT, "docs", "template.html")).read()
    used = set()

    def sub(mt):
        k = mt.group(1)
        if k not in V:
            sys.exit(f"template asks for {{{{{k}}}}}, which the build does not produce")
        used.add(k)
        return str(V[k])

    html = re.sub(r"\{\{(\w+)\}\}", sub, tpl)
    unused = sorted(set(V) - used)
    if unused:
        print("values produced but not used on the page:", ", ".join(unused), file=sys.stderr)
    open(os.path.join(ROOT, "docs", "index.html"), "w").write(html)


if __name__ == "__main__":
    with open(os.path.join(ROOT, "docs", "data.js"), "w") as fh:
        fh.write("// Generated by study/build_page_data.py from data/results.json. Do not edit.\n")
        fh.write("const D = " + json.dumps(chart_data(), separators=(",", ":")) + ";\n")
    if os.path.exists(os.path.join(ROOT, "docs", "template.html")):
        render()
    for k in sorted(V):
        print(f"  {k} = {V[k]}")
