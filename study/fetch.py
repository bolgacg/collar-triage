"""Download the public sources into data/raw/ (not committed; about 510 MB).

1. LifeTrack White Stork Rheinland-Pfalz (2015-2023), Movebank Data Repository,
   doi 10.5441/001/1.4192t2j4_2, CC0: the GPS files, the reference data and the README.
2. NATMed water buffalo collars, Lake Chimaditida, Greece (June to October 2025),
   Zenodo record 19627348, CC BY 4.0.

usage: python3 study/fetch.py
"""
import json, os, sys, time, urllib.request

ROOT = os.path.join(os.path.dirname(__file__), "..", "data", "raw")
MOVEBANK = "https://datarepository.movebank.org/server/api"
STORK_HANDLE = "10255/move.1687"
BUFFALO = "https://zenodo.org/api/records/19627348"


def get_json(url):
    for k in range(5):
        try:
            with urllib.request.urlopen(url, timeout=60) as r:
                return json.load(r)
        except Exception:
            if k == 4:
                raise
            time.sleep(3 + 3 * k)


def download(url, dest, size=None):
    if os.path.exists(dest) and (size is None or os.path.getsize(dest) == size):
        print("have", os.path.basename(dest))
        return
    for k in range(5):
        try:
            urllib.request.urlretrieve(url, dest)
            break
        except Exception as e:
            print("retry", os.path.basename(dest), e, file=sys.stderr)
            time.sleep(5 + 5 * k)
    if size is not None and os.path.getsize(dest) != size:
        sys.exit(f"{dest}: {os.path.getsize(dest)} bytes, expected {size}")
    print("got", os.path.basename(dest))


def storks():
    out = os.path.join(ROOT, "storks")
    os.makedirs(out, exist_ok=True)
    item = get_json(f"{MOVEBANK}/pid/find?id={STORK_HANDLE}")
    for bundle in get_json(item["_links"]["bundles"]["href"])["_embedded"]["bundles"]:
        if bundle["name"] != "ORIGINAL":
            continue
        for f in get_json(bundle["_links"]["bitstreams"]["href"] + "?size=100")["_embedded"]["bitstreams"]:
            name = f["name"]
            if "-gps-" in name or name.endswith("reference-data.csv") or name == "README.txt":
                download(f["_links"]["content"]["href"], os.path.join(out, name), f["sizeBytes"])


def buffalo():
    out = os.path.join(ROOT, "buffalo")
    os.makedirs(out, exist_ok=True)
    for f in get_json(BUFFALO)["files"]:
        download(f["links"]["self"], os.path.join(out, f["key"]), f["size"])


if __name__ == "__main__":
    storks()
    buffalo()
