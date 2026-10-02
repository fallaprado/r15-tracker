import requests
import json
import os
from datetime import datetime, date, timezone
from zoneinfo import ZoneInfo

GTFS_RT_URL = "https://gtfsrt.renfe.com/trip_updates.json"
DATA_DIR = "data"
MADRID_TZ = ZoneInfo("Europe/Madrid")


def timestamp_a_minuts(ts):
    if ts is None:
        return None
    try:
        dt = datetime.fromtimestamp(int(ts), tz=timezone.utc).astimezone(MADRID_TZ)
        return dt.hour * 60 + dt.minute
    except Exception:
        return None


def actualitzar_realtime():
    avui = date.today().isoformat()
    fitxer_path = os.path.join(DATA_DIR, f"{avui}.json")

    if not os.path.exists(fitxer_path):
        print(f"⚠️ No s'ha trobat el fitxer base {fitxer_path}. Executa primer collect.py.")
        return

    with open(fitxer_path, "r", encoding="utf-8") as f:
        dades = json.load(f)

    print("Descarregant GTFS-RT de Renfe...")
    try:
        resp = requests.get(
            GTFS_RT_URL,
            timeout=30,
            headers={"User-Agent": "R15-Tracker/1.0"}
        )
        resp.raise_for_status()
        feed = resp.json()
    except Exception as e:
        print(f"❌ Error descarregant GTFS-RT: {e}")
        return

    entities = feed.get("entity", [])

    # Indexar actualitzacions per trip_id
    updates_by_trip = {}
    for entity in entities:
        trip_update = entity.get("tripUpdate")
        if not trip_update:
            continue
        trip_id = str(trip_update.get("trip", {}).get("tripId", "")).strip()
        if trip_id:
            updates_by_trip[trip_id] = trip_update

    print(f"Trips trobats al GTFS-RT: {len(updates_by_trip)}")

    trens_actualitzats = 0

    for train in dades.get("trains", []):
        train_id = str(train.get("train_id", "")).strip()
        update = updates_by_trip.get(train_id)

        if not update:
            continue

        stop_updates = update.get("stopTimeUpdate", [])

        # Mapa per trobar la parada per stop_id o stop_sequence
        updates_by_stop_id = {}
        updates_by_seq = {}

        for stu in stop_updates:
            sid = str(stu.get("stopId", "")).strip()
            seq = stu.get("stopSequence")
            if sid:
                updates_by_stop_id[sid] = stu
            if seq is not None:
                updates_by_seq[seq] = stu

        max_delay = 0
        has_started = False

        for stop in train.get("stops", []):
            sid = str(stop.get("stop_id", "")).strip()
            seq = stop.get("sequence")

            stu = updates_by_stop_id.get(sid) or updates_by_seq.get(seq)
            if not stu:
                continue

            arr = stu.get("arrival", {})
            dep = stu.get("departure", {})

            # Agafar timestamp de sortida o arribada
            real_ts = dep.get("time") or arr.get("time")
            delay_sec = dep.get("delay") if dep.get("delay") is not None else arr.get("delay")

            if real_ts:
                stop["actual_minutes"] = timestamp_a_minuts(real_ts)
                has_started = True

            if delay_sec is not None:
                delay_min = round(delay_sec / 60)
                stop["delay_minutes"] = delay_min
                if delay_min > max_delay:
                    max_delay = delay_min

        if has_started:
            train["started"] = True
            train["final_delay_minutes"] = max_delay
            trens_actualitzats += 1

    # Desar les dades actualitzades
    with open(fitxer_path, "w", encoding="utf-8") as f:
        json.dump(dades, f, ensure_ascii=False, indent=2)

    print(f"✅ S'han actualitzat {trens_actualitzats} trens a {fitxer_path}")


if __name__ == "__main__":
    actualitzar_realtime()
