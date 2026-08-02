#!/usr/bin/env python3
"""Add approximate map centroids to the generated Electorate reference.

Each point is the median latitude/longitude of the GeoNames centroids for the postcodes already
assigned to that division. It is deliberately a display point, not an official electorate
centroid: postcode coverage is population-skewed and boundary postcodes are approximate.

Source: GeoNames AU postal codes (CC BY 4.0).
Run from the realm root: python3 scripts/build-electorate-map-centroids.py
"""
import io
import re
import statistics
import urllib.request
import zipfile


GEONAMES = "https://download.geonames.org/export/zip/AU.zip"
UA = {"User-Agent": "Mozilla/5.0 Embabel realm-gov-au map builder"}
TARGET = "reference/electorates.yml"
# Four AEC names receive no postcode in the existing centroid-in-polygon correspondence. These
# display-only fallbacks keep the national map complete; they are deliberately coarse.
FALLBACKS = {
    "Eden-Monaro": (-35.60, 149.00),
    "McEwen": (-37.30, 145.00),
    "McMahon": (-33.85, 150.90),
    "O'Connor": (-32.20, 121.00),
}


def coordinates():
    request = urllib.request.Request(GEONAMES, headers=UA)
    blob = urllib.request.urlopen(request, timeout=120).read()
    archive = zipfile.ZipFile(io.BytesIO(blob))
    grouped = {}
    for line in archive.read("AU.txt").decode("utf-8").splitlines():
        fields = line.split("\t")
        if len(fields) < 11 or not fields[1] or not fields[9] or not fields[10]:
            continue
        grouped.setdefault(fields[1], []).append((float(fields[9]), float(fields[10])))
    return {
        postcode: (
            statistics.median(point[0] for point in points),
            statistics.median(point[1] for point in points),
        )
        for postcode, points in grouped.items()
    }


def main():
    postcode_coordinates = coordinates()
    output = []
    updated = 0
    missing = []
    for line in open(TARGET):
        if line.strip().startswith("data: {"):
            postcodes = re.search(r"postcodes: \[([^]]*)]", line)
            if postcodes:
                values = re.findall(r'"(\d{4})"', postcodes.group(1))
                points = [postcode_coordinates[value] for value in values if value in postcode_coordinates]
                if points:
                    latitude = statistics.median(point[0] for point in points)
                    longitude = statistics.median(point[1] for point in points)
                    line = re.sub(r", centroidLat: -?[\d.]+, centroidLon: -?[\d.]+", "", line.rstrip())
                    line = line[:-2] + f", centroidLat: {latitude:.5f}, centroidLon: {longitude:.5f} }}\n"
                    updated += 1
                else:
                    division = re.search(r'division: "([^"]+)"', line)
                    missing.append(division.group(1) if division else "unknown")
            else:
                division = re.search(r'division: "([^"]+)"', line)
                name = division.group(1) if division else "unknown"
                if name in FALLBACKS:
                    latitude, longitude = FALLBACKS[name]
                    line = line.rstrip()[:-2] + f", centroidLat: {latitude:.5f}, centroidLon: {longitude:.5f} }}\n"
                    updated += 1
                else:
                    missing.append(name)
        output.append(line)
    if updated != 150:
        raise RuntimeError(f"expected 150 electorate centroids, generated {updated}; missing {missing}")
    open(TARGET, "w").writelines(output)
    print(f"{TARGET}: added {updated} approximate display centroids")


if __name__ == "__main__":
    main()
