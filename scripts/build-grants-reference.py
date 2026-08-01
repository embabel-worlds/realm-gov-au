#!/usr/bin/env python3
"""Regenerate reference/grants.yml and reference/postcode-division.json.

WHY GRANTS ARE SEEDED RATHER THAN FETCHED LIVE: GrantConnect publishes no API. Its only
machine-readable surface is an XLSX report download, which the tool gateway cannot consume, so a
live producer is not possible today. This bakes a BOUNDED, DATED snapshot instead — stated as a
snapshot everywhere it is used, never as the live register.

WHY GRANTS ARE WORTH THE TROUBLE: unlike contracts, a grant record carries DELIVERY State and
DELIVERY Postcode — where the money is actually spent, as distinct from the recipient's office.
Measured on the July 2026 export: delivery differs from the recipient's address in 99.4% of
grants. That is the only place in this realm where a geographic claim is honest.

Also emits the postcode -> federal division correspondence (AEC boundaries, centroid-in-polygon
over GeoNames postcode centroids) so grant delivery can be placed in an electorate. The centroid
method is approximate for a postcode straddling a boundary and every surface must say so.

Requires: shapely. Run from the realm root:  python3 scripts/build-grants-reference.py
"""
import collections
import csv
import io
import json
import math
import re
import struct
import urllib.request
import zipfile

UA = {"User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36"}
GA = ("https://www.grants.gov.au/Reports/GaPublishedDownload"
      "?AgencyStatus=0&DateType=Publish%20Date&DateStart={start}&DateEnd={end}")
GEONAMES = "https://download.geonames.org/export/zip/AU.zip"
AEC_BOUNDARIES = "https://www.aec.gov.au/Electorates/files/2025/AUS-March-2025-esri.zip"

# The snapshot window. Widen for more coverage; every consuming surface prints these dates.
START, END = "01-Jul-2026", "28-Jul-2026"
MIN_VALUE = 0  # keep everything; the file is a few MB and completeness beats terseness here


def fetch(url):
    return urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=600).read()


def read_xlsx_rows(blob):
    z = zipfile.ZipFile(io.BytesIO(blob))
    ss = re.findall(r"<si>(.*?)</si>", z.read("xl/sharedStrings.xml").decode("utf-8", "ignore"), re.S)
    strings = ["".join(re.findall(r"<t[^>]*>(.*?)</t>", s, re.S)) for s in ss]
    sheet = z.read("xl/worksheets/sheet1.xml").decode("utf-8", "ignore")

    def cells(r):
        out = []
        for c in re.findall(r"<c[^>]*>.*?</c>|<c[^>]*/>", r, re.S):
            t = re.search(r't="(\w+)"', c)
            v = re.search(r"<v>(.*?)</v>", c, re.S)
            if v:
                out.append(strings[int(v.group(1))] if (t and t.group(1) == "s") else v.group(1))
            else:
                inl = re.findall(r"<t[^>]*>(.*?)</t>", c, re.S)
                out.append("".join(inl) if inl else "")
        return out

    rows = [cells(r) for r in re.findall(r"<row[^>]*>(.*?)</row>", sheet, re.S)]
    hdr_i = next(i for i, r in enumerate(rows) if "Recipient Name" in r)
    hdr = rows[hdr_i]
    return hdr, [r for r in rows[hdr_i + 1:] if len(r) > 20]


def yq(s):
    return '"' + str(s).replace("\\", "\\\\").replace('"', '\\"') + '"'


# ---- postcode -> division (same method as the earlier geo build, kept here so grants own it) ----
def read_dbf(data):
    nrec = struct.unpack("<I", data[4:8])[0]
    hsize = struct.unpack("<H", data[8:10])[0]
    rsize = struct.unpack("<H", data[10:12])[0]
    fields, pos = [], 32
    while data[pos:pos + 1] != b"\r":
        fd = data[pos:pos + 32]
        fields.append((fd[:11].split(b"\x00")[0].decode("ascii"), fd[16]))
        pos += 32
    recs, pos = [], hsize
    for _ in range(nrec):
        raw = data[pos:pos + rsize]
        pos += rsize
        if not raw or raw[0:1] == b"\x1a":
            break
        p, rec = 1, {}
        for name, flen in fields:
            rec[name] = raw[p:p + flen].decode("latin1").strip()
            p += flen
        recs.append(rec)
    return recs


def read_shp_polygons(data):
    shapes, pos = [], 100
    while pos + 8 <= len(data):
        length = struct.unpack(">i", data[pos + 4:pos + 8])[0] * 2
        content = data[pos + 8:pos + 8 + length]
        pos += 8 + length
        if struct.unpack("<i", content[:4])[0] in (5, 15, 25):
            nparts, npoints = struct.unpack("<ii", content[36:44])
            parts = struct.unpack("<%di" % nparts, content[44:44 + 4 * nparts])
            off = 44 + 4 * nparts
            pts = struct.unpack("<%dd" % (npoints * 2), content[off:off + 16 * npoints])
            rings = []
            for i in range(nparts):
                s = parts[i]
                e = parts[i + 1] if i + 1 < nparts else npoints
                rings.append([(pts[2 * j], pts[2 * j + 1]) for j in range(s, e)])
            shapes.append(rings)
        else:
            shapes.append(None)
    return shapes


def postcode_divisions():
    from shapely.geometry import MultiPolygon, Point, Polygon
    from shapely.strtree import STRtree
    z = zipfile.ZipFile(io.BytesIO(fetch(GEONAMES)))
    agg = collections.defaultdict(list)
    for line in z.read("AU.txt").decode("utf-8").splitlines():
        f = line.split("\t")
        if len(f) < 11 or not f[1] or not f[9] or not f[10]:
            continue
        try:
            agg[f[1]].append((float(f[9]), float(f[10])))
        except ValueError:
            continue
    cents = {pc: (sum(a for a, _ in v) / len(v), sum(b for _, b in v) / len(v)) for pc, v in agg.items()}

    bz = zipfile.ZipFile(io.BytesIO(fetch(AEC_BOUNDARIES)))
    shp = next(n for n in bz.namelist() if n.endswith(".shp"))
    dbf = next(n for n in bz.namelist() if n.endswith(".dbf"))
    recs = read_dbf(bz.read(dbf))
    shapes = read_shp_polygons(bz.read(shp))
    geoms, names = [], []
    for rec, rings in zip(recs, shapes):
        if rings is None:
            continue
        geoms.append(MultiPolygon([Polygon(r) for r in rings if len(r) >= 4]).buffer(0))
        names.append(rec["Elect_div"])
    tree = STRtree(geoms)
    out = {}
    for pc, (lat, lon) in cents.items():
        p = Point(lon, lat)
        hit = next((names[i] for i in tree.query(p) if geoms[i].covers(p)), None)
        if hit is None:
            near = [(geoms[i].distance(p), names[i]) for i in tree.query(p.buffer(0.5))]
            hit = min(near)[1] if near else None
        if hit:
            out[pc] = hit
    return out


def main():
    hdr, rows = read_xlsx_rows(fetch(GA.format(start=START, end=END)))
    col = {name: i for i, name in enumerate(hdr)}

    def g(r, name):
        i = col.get(name)
        return (r[i] if i is not None and i < len(r) else "").strip()

    kept = []
    for r in rows:
        try:
            value = float(g(r, "Value (AUD)") or 0)
        except ValueError:
            value = 0.0
        if value < MIN_VALUE:
            continue
        kept.append({
            "gaId": g(r, "GA ID"), "agency": g(r, "Agency"),
            "recipient": g(r, "Recipient Name"), "recipientAbn": g(r, "Recipient ABN"),
            "program": g(r, "Grant Program"), "pbsProgram": g(r, "PBS Program Name"),
            "purpose": g(r, "Purpose")[:400],
            "value": round(value, 2),
            "approvalDate": g(r, "Approval Date"), "startDate": g(r, "Start Date"), "endDate": g(r, "End Date"),
            "selectionProcess": g(r, "Selection Process"), "category": g(r, "Category"),
            "recipientPostcode": g(r, "Recipient Postcode"), "recipientState": g(r, "Recipient State/Territory"),
            "deliveryPostcode": g(r, "Delivery Postcode"), "deliveryState": g(r, "Delivery State/Territory"),
        })

    # SPLIT INTO CHUNKS: SnakeYAML rejects a document over ~3MB, and the realm loader then drops
    # the WHOLE file with a single terse problem — 7,067 grants vanished silently that way once.
    CHUNK = 1800
    parts = [kept[i:i + CHUNK] for i in range(0, len(kept), CHUNK)]
    for old in __import__("glob").glob("reference/grants-*.yml"):
        __import__("os").remove(old)
    for n, part in enumerate(parts, 1):
      with open(f"reference/grants-{n:02d}.yml", "w") as f:
        f.write(f"# GENERATED by scripts/build-grants-reference.py — part {n} of {len(parts)}. Do not hand-edit.\n")
        f.write(f"# Source: GrantConnect grant-award report, published {START} to {END} (CC BY 3.0 AU).\n")
        f.write("#\n")
        f.write("# A DATED SNAPSHOT, not a live feed: GrantConnect publishes no API, only an XLSX\n")
        f.write("# report the gateway cannot consume. Every surface using this must say 'as at' and\n")
        f.write("# must not imply it is current.\n")
        f.write("#\n")
        f.write("# The reason grants are here at all: a grant carries DELIVERY postcode and state —\n")
        f.write("# where the money is spent — which contracts do not. On this export delivery differs\n")
        f.write("# from the recipient's own address in 99.4% of grants.\n\n")
        for k in part:
            data = ", ".join(
                f"{kk}: {yq(vv)}" if isinstance(vv, str) else f"{kk}: {vv}" for kk, vv in k.items() if vv != ""
            )
            f.write(f"- type: Grant\n  data: {{ {data} }}\n")

    total = sum(k["value"] for k in kept)
    print(f"reference/grants.yml: {len(kept)} grants, ${total:,.0f}, published {START}–{END}")

    # The correspondence is folded INTO reference/electorates.yml as a `postcodes` list per
    # division (150 rows carrying ~21 postcodes each), so placing a grant is one graph hop
    # (`deliveryPostcode IN e.postcodes`) rather than a second lookup table nothing can traverse.
    mapping = postcode_divisions()
    by_div = collections.defaultdict(list)
    for pc, div in mapping.items():
        by_div[div].append(pc)
    src = open("reference/electorates.yml").read()
    out = []
    for line in src.splitlines():
        m = re.search(r'division: "([^"]+)"', line) if line.strip().startswith("data: {") else None
        if m and by_div.get(m.group(1)):
            pcs = ", ".join(f'"{p}"' for p in sorted(by_div[m.group(1)]))
            line = line.rstrip().rstrip("}").rstrip() + f", postcodes: [{pcs}] }}"
        out.append(line)
    open("reference/electorates.yml", "w").write("\n".join(out) + "\n")
    print(f"electorates.yml: postcodes folded in for {len(by_div)} divisions ({len(mapping)} postcodes)")


if __name__ == "__main__":
    main()
