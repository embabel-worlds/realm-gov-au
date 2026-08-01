#!/usr/bin/env python3
"""Regenerate apps/oz-map-data.js and reference/postcode-division.json. Do not hand-edit those.

Inputs (all open):
  - Natural Earth 50m admin-0 countries (public domain)  -> Australia outline paths
  - GeoNames postal codes AU.zip (CC BY 4.0)              -> postcode centroids
  - AEC national electoral boundaries ESRI zip (CC BY),
    https://www.aec.gov.au/Electorates/files/2025/AUS-March-2025-esri.zip
                                                          -> postcode -> division (centroid-in-polygon)
  - Parliamentary Handbook API (keyless OData)            -> current members per division

METHOD CAVEAT that every consuming surface must repeat: a postcode can span divisions; the
correspondence assigns each postcode by its CENTROID, so boundary-straddling postcodes are
approximate. Update the boundary zip URL on each redistribution and re-run.

Requires: shapely. Run from the realm root:  python3 scripts/build-geo-assets.py
"""
import collections
import io
import json
import math
import struct
import urllib.request
import zipfile

NE_URL = "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_50m_admin_0_countries.geojson"
GEONAMES_URL = "https://download.geonames.org/export/zip/AU.zip"
AEC_URL = "https://www.aec.gov.au/Electorates/files/2025/AUS-March-2025-esri.zip"
HANDBOOK_URL = ("https://handbookapi.aph.gov.au/api/individuals"
                "?%24filter=InCurrentParliament%20eq%20%27True%27%20and%20Electorate%20ne%20%27%27"
                "&%24select=PHID,DisplayName,Party,PartyAbbrev,Electorate,StateAbbrev")
UA = {"User-Agent": "Mozilla/5.0 (realm-gov-au build-geo-assets)"}

LON0, LON1, LAT0, LAT1 = 112.5, 154.5, -44.2, -9.8
W = 760
K = math.cos(math.radians(-27))
H = round(W * (LAT1 - LAT0) / ((LON1 - LON0) * K))


def fetch(url):
    return urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=300).read()


def outline_paths():
    ne = json.loads(fetch(NE_URL))
    aus = next(f for f in ne["features"] if f["properties"].get("ADMIN") == "Australia")
    geom = aus["geometry"]
    polys = geom["coordinates"] if geom["type"] == "MultiPolygon" else [geom["coordinates"]]
    X = lambda lon: (lon - LON0) / (LON1 - LON0) * W
    Y = lambda lat: (LAT1 - lat) / (LAT1 - LAT0) * H
    paths = []
    for poly in polys:
        ring = poly[0]
        lons = [p[0] for p in ring]
        lats = [p[1] for p in ring]
        if max(lons) < LON0 or min(lons) > LON1 or max(lats) < LAT0 or min(lats) > LAT1:
            continue  # external territories
        pts = [(round(X(lo), 1), round(Y(la), 1)) for lo, la in ring]
        out = [pts[0]]
        for p in pts[1:]:
            if p != out[-1]:
                out.append(p)
        paths.append("M" + " L".join(f"{x} {y}" for x, y in out) + "Z")
    return paths


def postcode_centroids():
    z = zipfile.ZipFile(io.BytesIO(fetch(GEONAMES_URL)))
    agg = collections.defaultdict(list)
    for line in z.read("AU.txt").decode("utf-8").splitlines():
        f = line.split("\t")
        if len(f) < 11 or not f[1] or not f[9] or not f[10]:
            continue
        try:
            la, lo = float(f[9]), float(f[10])
        except ValueError:
            continue
        if not (LON0 - 2 <= lo <= LON1 + 2 and LAT0 - 2 <= la <= LAT1 + 2):
            continue
        agg[f[1]].append((la, lo))
    return {pc: [round(sum(a for a, _ in v) / len(v), 3), round(sum(b for _, b in v) / len(v), 3)]
            for pc, v in agg.items()}


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
        stype = struct.unpack("<i", content[:4])[0]
        if stype in (5, 15, 25):
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


def postcode_division(centroids):
    from shapely.geometry import MultiPolygon, Point, Polygon
    from shapely.strtree import STRtree
    z = zipfile.ZipFile(io.BytesIO(fetch(AEC_URL)))
    shp = next(n for n in z.namelist() if n.endswith(".shp"))
    dbf = next(n for n in z.namelist() if n.endswith(".dbf"))
    recs = read_dbf(z.read(dbf))
    shapes = read_shp_polygons(z.read(shp))
    geoms, names = [], []
    for rec, rings in zip(recs, shapes):
        if rings is None:
            continue
        outers = [r for r in rings if len(r) >= 4]
        geoms.append(MultiPolygon([Polygon(r) for r in outers]).buffer(0))
        names.append(rec["Elect_div"])
    tree = STRtree(geoms)
    mapping = {}
    for pc, (lat, lon) in centroids.items():
        p = Point(lon, lat)
        hit = next((names[i] for i in tree.query(p) if geoms[i].covers(p)), None)
        if hit is None:  # coastal centroid just offshore -> nearest division within 0.5 deg
            near = [(geoms[i].distance(p), names[i]) for i in tree.query(p.buffer(0.5))]
            hit = min(near)[1] if near else None
        if hit:
            mapping[pc] = hit
    return mapping


def current_members():
    v = json.loads(fetch(HANDBOOK_URL))["value"]
    return {m["Electorate"]: {"name": m["DisplayName"], "party": m["Party"],
                              "partyAbbrev": m["PartyAbbrev"].strip(), "state": m["StateAbbrev"],
                              "phid": m["PHID"]} for m in v}


def main():
    import datetime
    today = datetime.date.today().isoformat()
    paths = outline_paths()
    cents = postcode_centroids()
    mapping = postcode_division(cents)
    members = current_members()
    with open("apps/oz-map-data.js", "w") as f:
        f.write(f"// Built by scripts/build-geo-assets.py on {today}. Do not hand-edit.\n")
        f.write("// Australia outline: Natural Earth 50m admin-0 (public domain), plate carree, "
                "external territories dropped.\n")
        f.write(f"window.OZ_OUTLINE = {{ viewBox: '0 0 {W} {H}', paths: {json.dumps(paths)} }};\n")
        f.write("// Postcode centroids: GeoNames postal codes AU (CC BY 4.0, geonames.org), averaged per postcode.\n")
        f.write("window.OZ_POSTCODES = " + json.dumps(cents, separators=(",", ":")) + ";\n")
        f.write("// Postcode -> division: AEC national boundaries (CC BY), CENTROID-in-polygon — "
                "boundary-straddling postcodes are approximate; consuming surfaces must say so.\n")
        f.write("window.OZ_DIVISIONS = " + json.dumps(mapping, separators=(",", ":")) + ";\n")
        f.write("// Current House members per division (Parliamentary Handbook API). Demo fallback; "
                "live mode fetches fresh. Geography, not association.\n")
        f.write("window.OZ_MEMBERS = " + json.dumps(members, separators=(",", ":")) + ";\n")
    with open("reference/postcode-division.json", "w") as f:
        json.dump(mapping, f)
    print(f"outline rings={len(paths)} postcodes={len(cents)} mapped={len(mapping)} members={len(members)}")


if __name__ == "__main__":
    main()
