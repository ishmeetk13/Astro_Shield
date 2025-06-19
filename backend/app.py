from flask import Flask, request, jsonify, render_template
from sgp4.api import Satrec, jday
from datetime import datetime, timedelta,timezone
import numpy as np
import requests 
import random
app= Flask(__name__)

TLE_SOURCES={
    "GPS-OPS":"https://celestrak.org/Norad/elements/gp.php?GROUP=gps-ops&FORMAT=tle", "Kuiper":"https://www.celestrak.org/NORAD/elements/gp.php?GROUP=kuiper&FORMAT=tle","OneWeb":"https://www.celestrak.org/NORAD/elements/gp.php?GROUP=oneweb&FORMAT=tle","Starlink":"https://www.celestrak.org/NORAD/elements/gp.php?GROUP=starlink&FORMAT=tle"
}

def load_demo_tle():
    return [
        ["SAT-A", 
         "1 99991U 24001A   24123.50000000  .00000000  00000-0  00000-0 0  9991",
         "2 99991  51.6000  0.0000 0001000  0.0000  0.0000 15.00000000    01"],
        
        ["SAT-B", 
         "1 99992U 24001B   24123.50000000  .00000000  00000-0  00000-0 0  9992",
         "2 99992  51.6000  0.0000 0001000  0.0005  0.0000 15.00000000    02"],

        ["SAT-C", 
         "1 99993U 24001C   24123.50000000  .00000000  00000-0  00000-0 0  9993",
         "2 99993  51.6000  0.0100 0001000  0.0002  0.0000 15.00000000    03"],

        ["SAT-D", 
         "1 99994U 24001D   24123.50000000  .00000000  00000-0  00000-0 0  9994",
         "2 99994  55.0000  10.0000 0001000  0.0000  0.0000 14.90000000    04"]
    ]
@app.route("/tle")
def get_tle():
    mode= request.args.get("mode","live")
    group=request.args.get("group","GPS-OPS")

    if mode == "demo":
        return jsonify(load_demo_tle())
    try:
        response=requests.get(TLE_SOURCES[group])
        response.raise_for_status()
        lines=response.text.strip().split("\n")
        num_sats=len(lines)//3
        sample_size=min(25,num_sats)
        sampled=random.sample(range(0,num_sats),sample_size)
        tle_data=[lines[i*3:(i+1)*3] for i in sampled]
        return jsonify(tle_data)
    except:
        try:
            with open(f"{group.lower()}.txt","r") as f:
                lines=f.read().strip().split("\n")
                tle_data=[lines[i:i+3] for i in range(0,min(len(lines),75),3)]
                return jsonify(tle_data)
        except Exception as e:
            return jsonify({"error":f"Failed to load fallback TLEs:{str(e)}"}),500
        
@app.route("/propogate", method=["POST"])
def propogate_orbit():
    tle=request.json.get("tle")
    if not tle or len(tle)<3:
        return jsonify({"error":"Invalid TLE"}),400
    
    sat=Satrec.twoline2rv(tle[1],tle[2])
    now=datetime.now(timezone.utc)
    coords=[]
    for minute in range(0,90,1):
        dt=now + timedelta(minutes=minute)
        jd,fr=jday(dt.year,dt.month,dt.day,dt.minute,dt.second)
        e,r,_=sat.sgp4(jd,fr)
        if e==0:
            coords.append(r)
        return jsonify(coords)
    
@app.route("/collisions",methods=["POST"])
def detect_collisions():
    data=request.json
    sats=data.get("sats")
    threshold_km= data.get("threshold",25)
    now=datetime.now(timezone.utc)
    jd,fr=jday(now.year,now.month,now.day,now.hour,now.minute,now.second)
    collisions=[]

    for i in range(len(sats)):
        for j in range(i+1,len(sats)):
            s1=Satrec.twoline2rv(sats[i][1],sats[i][2])
            s2=Satrec.twoline2rv(sats[j][1],sats[j][2])
            e1,r1,v1=s1.sgp4(jd,fr)
            e2,r2,v2=s2.sgp4(jd,fr)
            if e1!=0 or e2!=0:
                continue

            r1=np.array(r1)
            r2=np.array(r2)
            dist=np.linalg.norm(r2-r1)
            if dist<0.001 or np.allclose(r1,r2,atol=1e-3):
                continue 
            rel_pos=r2-r1
            rel_vel=v2-v1

            t_ca=-np.dot(rel_pos,rel_vel)/np.dot(rel_vel,rel_vel)
            if dist < threshold_km:
                collisions.append({"sat1":sats[i][0],"sat2":sats[j][0],"distance":dist,"t_ca":max(0,t_ca)})
                return jsonify(collisions)
#running app
if __name__ == "__main__":
    app.run(debug=True)
