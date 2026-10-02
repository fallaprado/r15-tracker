import requests
import json
import os
import re
import time
from datetime import datetime, date

GTFS_RT_URL = "https://gtfsrt.renfe.com/trip_updates.json"
DATA_DIR = "data"


def extreure_numero_tren(text):
    """Extreu el número de tren de 4 a 6 dígits (ej. de '15_071403_R15' extreu '71403')."""
    if not text:
        return ""
    matches = re.findall(r'(?<!\d)\d{4,6}(?!\d)', str(text))
    if matches:
        return matches[0].lstrip('0')
    digits = re.sub(r'\D', '', str(text))
    return digits.lstrip('0')


def timestamp_a_minuts_local(ts):
    """Converteix un timestamp Unix en minuts des de mitjanit en l'hora local d'Espanya."""
    if ts is None:
        return None
    try:
        ts = int(ts)
        if ts > 2000000000:
            ts = ts // 1000
        time_struct = time.localtime(ts)
        return time_struct.tm_hour * 60 + time_struct.tm_min
    except Exception:
        return None


def actualitzar_realtime():
    avui = date.today().isoformat()
    fitxer_path = os.path.join(DATA_DIR, f"{avui}.json")

    if not os.path.exists(fitxer_path):
        print(f"⚠️ Fitxer base {fitxer_path} no trobat. Executa primer collect.py.")
        return

    with open(fitxer_path, "r", encoding="utf-8") as f:
        dades = json.load(f)

    print(f"Descarregant GTFS-RT de Renfe ({GTFS_RT_URL})...")
    try:
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) R15Tracker/1.0",
            "Accept": "application/json"
        }
        resp = requests.get(GTFS_RT_URL, timeout=30, headers=headers)
        resp.raise_for_status()
        feed = resp.json()
    except Exception as e:
        print(f"❌ Error descarregant GTFS-RT de Renfe: {e}")
        return

    entities = feed.get("entity", [])
    print(f"Rebuts {len(entities)} elements de l'API GTFS-RT.")

    # Indexar les actualitzacions pel número de tren de 5 dígits
    updates_by_num = {}
    for entity in entities:
        trip_update = entity.get("tripUpdate")
        if not trip_update:
            continue
        
        trip_data = trip_update.get("trip", {})
        raw_trip_id = trip_data.get("tripId", "")
        num_tren = extreure_numero_tren(raw_trip_id)
        
        if num_tren:
            updates_by_num[num_tren] = trip_update

    trens_actualitzats = 0

    for train in dades.get("trains", []):
        raw_train_id = train.get("train_id", "")
        num_tren = extreure_numero_tren(raw_train_id)

        update = updates_by_num.get(num_tren)

        if not update:
            continue

        stop_updates = update.get("stopTimeUpdate", [])

        # Indexar per seqüència i per ID d'estació
        updates_by_seq = {}
        updates_by_stop_id = {}

        for stu in stop_updates:
            seq = stu.get("stopSequence")
            sid = str(stu.get("stopId", "")).strip()
            clean_sid = extreure_numero_tren(sid)

            if seq is not None:
                updates_by_seq[int(seq)] = stu
            if clean_sid:
                updates_by_stop_id[clean_sid] = stu

        max_delay = 0
        has_updates = False

        for stop in train.get("stops", []):
            seq = stop.get("sequence")
            sid = str(stop.get("stop_id", "")).strip()
            clean_sid = extreure_numero_tren(sid)

            stu = (updates_by_seq.get(seq) if seq is not None else None) or updates_by_stop_id.get(clean_sid)

            if not stu:
                continue

            arr = stu.get("arrival", {}) or {}
            dep = stu.get("departure", {}) or {}

            real_ts = dep.get("time") or arr.get("time")
            delay_sec = dep.get("delay") if dep.get("delay") is not None else arr.get("delay")

            scheduled_time = stop.get("scheduled_departure") or stop.get("scheduled_arrival")

            delay_min = None
            if delay_sec is not None:
                delay_min = round(delay_sec / 60)
                stop["delay_minutes"] = delay_min
                if delay_min > max_delay:
                    max_delay = delay_min

            if real_ts:
                stop["actual_minutes"] = timestamp_a_minuts_local(real_ts)
                has_updates = True
            elif delay_min is not None and scheduled_time is not None:
                stop["actual_minutes"] = scheduled_time + delay_min
                has_updates = True

        if has_updates:
            train["started"] = True
            train["final_delay_minutes"] = max(0, max_delay)
            trens_actualitzats += 1

    with open(fitxer_path, "w", encoding="utf-8") as f:
        json.dump(dades, f, ensure_ascii=False, indent=2)

    print(f"✅ Actualitzats {trens_actualitzats} trens amb dades en temps real a {fitxer_path}.")


if __name__ == "__main__":
    actualitzar_realtime()
