import requests
import json
import os
import re
from datetime import datetime, date, timezone
from zoneinfo import ZoneInfo

GTFS_RT_URL = "https://gtfsrt.renfe.com/trip_updates.json"
DATA_DIR = "data"
MADRID_TZ = ZoneInfo("Europe/Madrid")


def netejar_id(id_val):
    """Neteja zeros a l'esquerra i caràcters especials per facilitar la cerca d'IDs."""
    if not id_val:
        return ""
    s = str(id_val).strip()
    # Mantenim només els dígits principals o treiem zeros inicials
    digits = re.sub(r"\D", "", s).lstrip("0")
    return digits if digits else s.lstrip("0")


def timestamp_a_minuts(ts):
    if ts is None:
        return None
    try:
        ts = int(ts)
        if ts > 2000000000:  # Si ve en mil·lissegons
            ts = ts // 1000
        dt = datetime.fromtimestamp(ts, tz=timezone.utc).astimezone(MADRID_TZ)
        return dt.hour * 60 + dt.minute
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

    print(f"Descarregant GTFS-RT de Renfe per actualitzar {fitxer_path}...")
    try:
        resp = requests.get(
            GTFS_RT_URL,
            timeout=30,
            headers={"User-Agent": "R15-Tracker/1.0"}
        )
        resp.raise_for_status()
        feed = resp.json()
    except Exception as e:
        print(f"❌ Error descarregant GTFS-RT de Renfe: {e}")
        return

    entities = feed.get("entity", [])

    # Indexar actualitzacions per ID netejat
    updates_by_clean_id = {}
    for entity in entities:
        trip_update = entity.get("tripUpdate")
        if not trip_update:
            continue
        raw_trip_id = str(trip_update.get("trip", {}).get("tripId", "")).strip()
        clean_id = netejar_id(raw_trip_id)
        if clean_id:
            updates_by_clean_id[clean_id] = trip_update

    trens_actualitzats = 0

    for train in dades.get("trains", []):
        raw_train_id = str(train.get("train_id", "")).strip()
        clean_train_id = netejar_id(raw_train_id)

        # Buscar coincidència flexible d'ID
        update = updates_by_clean_id.get(clean_train_id)

        if not update:
            # Provar de cercar si l'ID està contingut
            for k, v in updates_by_clean_id.items():
                if k and (k in clean_train_id or clean_train_id in k):
                    update = v
                    break

        if not update:
            continue

        stop_updates = update.get("stopTimeUpdate", [])

        # Indexar stop updates per seqüència i per ID d'estació
        updates_by_seq = {}
        updates_by_stop_id = {}

        for stu in stop_updates:
            seq = stu.get("stopSequence")
            sid = str(stu.get("stopId", "")).strip()
            clean_sid = netejar_id(sid)

            if seq is not None:
                updates_by_seq[int(seq)] = stu
            if clean_sid:
                updates_by_stop_id[clean_sid] = stu

        max_delay = 0
        has_updates = False

        for stop in train.get("stops", []):
            seq = stop.get("sequence")
            sid = str(stop.get("stop_id", "")).strip()
            clean_sid = netejar_id(sid)

            stu = (updates_by_seq.get(seq) if seq is not None else None) or updates_by_stop_id.get(clean_sid)

            if not stu:
                continue

            arr = stu.get("arrival", {}) or {}
            dep = stu.get("departure", {}) or {}

            real_ts = dep.get("time") or arr.get("time")
            delay_sec = dep.get("delay") if dep.get("delay") is not None else arr.get("delay")

            scheduled_time = stop.get("scheduled_departure") or stop.get("scheduled_arrival")

            # 1. Calcular retard en minuts
            delay_min = None
            if delay_sec is not None:
                delay_min = round(delay_sec / 60)
                stop["delay_minutes"] = delay_min
                if delay_min > max_delay:
                    max_delay = delay_min

            # 2. Calcular minuts reals
            if real_ts:
                stop["actual_minutes"] = timestamp_a_minuts(real_ts)
                has_updates = True
            elif delay_min is not None and scheduled_time is not None:
                # Si l'API no envia timestamp Unix, calculem temps real = teòric + retard
                stop["actual_minutes"] = scheduled_time + delay_min
                has_updates = True

        if has_updates:
            train["started"] = True
            train["final_delay_minutes"] = max(0, max_delay)
            trens_actualitzats += 1

    # Desat de dades
    with open(fitxer_path, "w", encoding="utf-8") as f:
        json.dump(dades, f, ensure_ascii=False, indent=2)

    print(f"✅ S'han actualitzat {trens_actualitzats} trens amb dades reals a {fitxer_path}.")


if __name__ == "__main__":
    actualitzar_realtime()
