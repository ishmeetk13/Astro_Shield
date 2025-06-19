from flask import Flask, request, jsonify
from sgp4.api import Satrec, jday
from datetime import datetime, timedelta, timezone
import numpy as np
import requests
import random

app = Flask(__name__)

# Source TLE URLs
TLE_SOURCES = {
    "GPS-OPS": "https://celestrak.org/NORAD/elements/gp.php?GROUP=gps-ops&FORMAT=tle",
    "Kuiper": "https://celestrak.org/NORAD/elements/gp.php?GROUP=kuiper&FORMAT=tle",
    "OneWeb": "https://celestrak.org/NORAD/elements/gp.php?GROUP=oneweb&FORMAT=tle",
    "Starlink": "https://celestrak.org/NORAD/elements/gp.php?GROUP=starlink&FORMAT=tle"
}

# Demo TLEs
def load_demo_tle():
    return [
        ["SAT-A", "1 99991U 24001A   24123.50000000  .00000000  00000-0  00000-0 0  9991",
         "2 99991  51.6000  0.0000 0001000  0.0000  0.0000 15.00000000    01"],
        ["SAT-B", "1 99992U 24001B   24123.50000000  .00000000  00000-0  00000-0 0  9992",
         "2 99992  51.6000  0.0000 0001000  0.0005  0.0000 15.00000000    02"],
        ["SAT-C", "1 99993U 24001C   24123.50000000  .00000000  00000-0  00000-0 0  9993",
         "2 99993  51.6000  0.0100 0001000  0.0002  0.0000 15.00000000    03"],
        ["SAT-D", "1 99994U 24001D   24123.50000000  .00000000  00000-0  00000-0 0  9994",
         "2 99994  55.0000  10.0000 0001000  0.0000  0.0000 14.90000000    04"]
    ]

# API: /tle
@app.route("/tle")
def get_tle():
    mode = request.args.get("mode", "live")
    group = request.args.get("group", "GPS-OPS")

    if mode == "demo":
        return jsonify(load_demo_tle())

    try:
        response = requests.get(TLE_SOURCES[group])
        response.raise_for_status()
        lines = response.text.strip().split("\n")
        num_sats = len(lines) // 3
        sample = random.sample(range(num_sats), min(25, num_sats))
        tle_data = [lines[i*3:i*3+3] for i in sample]
        return jsonify(tle_data)
    except:
        try:
            with open(f"{group.lower()}.txt", "r") as f:
                lines = f.read().strip().split("\n")
                tle_data = [lines[i:i+3] for i in range(0, min(len(lines), 75), 3)]
                return jsonify(tle_data)
        except Exception as e:
            return jsonify({"error": str(e)}), 500

# API: /propogate
@app.route("/propogate", methods=["POST"])
def propogate_orbit():
    tle = request.json.get("tle")
    if not tle or len(tle) < 3:
        return jsonify({"error": "Invalid TLE"}), 400

    sat = Satrec.twoline2rv(tle[1], tle[2])
    now = datetime.now(timezone.utc)
    coords = []

    for minute in range(0, 90, 1):
        dt = now + timedelta(minutes=minute)
        jd, fr = jday(dt.year, dt.month, dt.day, dt.hour, dt.minute, dt.second)
        e, r, _ = sat.sgp4(jd, fr)
        if e == 0:
            coords.append(r)

    return jsonify(coords)

# Maneuver Suggestion
def suggest_maneuver(pos, vel):
    vel = np.array(vel)
    delta_v = np.cross(vel, [0, 0, 1])
    if np.linalg.norm(delta_v) == 0:
        delta_v = np.array([0.01, 0, 0])
    else:
        delta_v = 0.01 * delta_v / np.linalg.norm(delta_v)
    return delta_v.tolist()

# Secondary Collision Detection
def check_secondary(primary, delta_v, sats, jd, fr, threshold):
    s1 = Satrec.twoline2rv(primary[1], primary[2])
    _, r1, v1 = s1.sgp4(jd, fr)
    new_v = np.array(v1) + np.array(delta_v)

    for s in sats:
        if s[0] == primary[0]:
            continue
        s2 = Satrec.twoline2rv(s[1], s[2])
        _, r2, v2 = s2.sgp4(jd, fr)
        dist = np.linalg.norm(np.array(r2) - np.array(r1))
        rel_vel = np.array(v2) - new_v
        rel_pos = np.array(r2) - np.array(r1)
        tca = -np.dot(rel_pos, rel_vel) / np.dot(rel_vel, rel_vel)
        if dist < threshold and tca > 0:
            return True
    return False

# API: /collisions
@app.route("/collisions", methods=["POST"])
def detect_collisions():
    data = request.json
    sats = data.get("sats")
    threshold_km = data.get("threshold", 25)
    now = datetime.now(timezone.utc)
    jd, fr = jday(now.year, now.month, now.day, now.hour, now.minute, now.second)

    collisions = []

    for i in range(len(sats)):
        for j in range(i + 1, len(sats)):
            s1 = Satrec.twoline2rv(sats[i][1], sats[i][2])
            s2 = Satrec.twoline2rv(sats[j][1], sats[j][2])
            e1, r1, v1 = s1.sgp4(jd, fr)
            e2, r2, v2 = s2.sgp4(jd, fr)
            if e1 != 0 or e2 != 0:
                continue

            r1 = np.array(r1)
            r2 = np.array(r2)
            dist = np.linalg.norm(r2 - r1)

            # Ignore identical orbits
            if dist < 0.001 or np.allclose(r1, r2, atol=1e-3):
                continue

            rel_pos = r2 - r1
            rel_vel = np.array(v2) - np.array(v1)
            t_ca = -np.dot(rel_pos, rel_vel) / np.dot(rel_vel, rel_vel)

            if dist < threshold_km:
                delta_v = suggest_maneuver(r1, v1)
                risky = check_secondary(sats[i], delta_v, sats, jd, fr, threshold_km)

                collisions.append({
                    "sat1": sats[i][0],
                    "sat2": sats[j][0],
                    "distance": dist,
                    "tca": max(0, t_ca),
                    "delta_v": delta_v,
                    "risky": risky
                })

    return jsonify(collisions)

# Run the app
if __name__ == "__main__":
    app.run(debug=True)

