import requests
import json
import os
from datetime import datetime, date, timezone
from zoneinfo import ZoneInfo

GTFS_RT_URL = "https://gtfsrt.renfe.com/trip_updates.json"
DATA_DIR = "data"

avui = date.today()

fitxer = os.path.join(
    DATA_DIR,
    f"{avui.isoformat()}.json"
)

MADRID_TZ = ZoneInfo("Europe/Madrid")


print("==========================================")
print("R15 REALTIME")
print("Data:", avui)
print("==========================================")


# ============================================================
# CARREGAR FITXER DEL DIA
# ============================================================

if not os.path.exists(fitxer):

    raise Exception(
        f"No existeix el fitxer {fitxer}"
    )


print("Carregant:", fitxer)


with open(
    fitxer,
    "r",
    encoding="utf-8"
) as f:

    dades = json.load(f)


# ============================================================
# DESCARREGAR FEED RENFE
# ============================================================

print("Descarregant GTFS-RT de Renfe...")


response = requests.get(
    GTFS_RT_URL,
    timeout=30,
    headers={
        "User-Agent": "R15-Tracker/1.0"
    }
)


response.raise_for_status()


print(
    "Feed descarregat:",
    len(response.content),
    "bytes"
)


try:

    feed = response.json()

except Exception as error:

    print(
        "Resposta rebuda:",
        response.text[:500]
    )

    raise Exception(
        "El feed de Renfe no és un JSON vàlid"
    ) from error


print("JSON carregat correctament.")


entities = feed.get(
    "entity",
    []
)


print(
    "Entitats:",
    len(entities)
)


# ============================================================
# CONSTRUIR DICCIONARI DE TRAINS REALTIME
# ============================================================

realtime_trips = {}


for entity in entities:

    trip_update = entity.get(
        "tripUpdate"
    )

    if not trip_update:
        continue


    trip = trip_update.get(
        "trip",
        {}
    )


    trip_id = str(
        trip.get(
            "tripId",
            ""
        )
    ).strip()


    if not trip_id:
        continue


    realtime_trips[
        trip_id
    ] = trip_update


print(
    "Trips amb informació:",
    len(realtime_trips)
)


# ============================================================
# FUNCIONS DE TEMPS
# ============================================================

def timestamp_a_datetime(timestamp):

    """
    Converteix timestamp Unix a datetime
    en hora local d'Espanya.
    """

    if timestamp is None:
        return None


    try:

        timestamp = int(timestamp)


        dt_utc = datetime.fromtimestamp(
            timestamp,
            tz=timezone.utc
        )


        return dt_utc.astimezone(
            MADRID_TZ
        )


    except Exception:

        return None


def timestamp_a_minuts(timestamp):

    """
    Converteix timestamp Unix a minuts
    del dia en hora d'Espanya.
    """

    dt = timestamp_a_datetime(
        timestamp
    )


    if dt is None:
        return None


    return (
        dt.hour * 60
        + dt.minute
    )


def timestamp_a_iso(timestamp):

    """
    Converteix timestamp Unix a ISO
    amb zona horària d'Espanya.
    """

    dt = timestamp_a_datetime(
        timestamp
    )


    if dt is None:
        return None


    return dt.isoformat()


# ============================================================
# ACTUALITZAR TRENS
# ============================================================

actualitzats = 0
parades_actualitzades = 0


for train in dades.get(
    "trains",
    []
):

    trip_id = str(
        train.get(
            "train_id",
            ""
        )
    ).strip()


    if not trip_id:
        continue


    trip_update = realtime_trips.get(
        trip_id
    )


    if trip_update is None:
        continue


    actualitzats += 1


    print()
    print(
        "Actualitzant tren:",
        trip_id
    )


    # ========================================================
    # INFORMACIÓ GENERAL
    # ========================================================

    trip_info = trip_update.get(
        "trip",
        {}
    )


    schedule_relationship = (
        trip_info.get(
            "scheduleRelationship"
        )
    )


    if schedule_relationship:

        train[
            "schedule_relationship"
        ] = schedule_relationship


    # ========================================================
    # PARADES REALTIME
    # ========================================================

    stop_updates = trip_update.get(
        "stopTimeUpdate",
        []
    )


    print(
        "Actualitzacions de parades:",
        len(stop_updates)
    )


    stops = train.get(
        "stops",
        []
    )


    # ========================================================
    # INDEXAR LES NOSTRES PARADES
    # ========================================================

    stops_by_id = {}

    stops_by_sequence = {}


    for index, stop in enumerate(
        stops
    ):

        stop_id = str(
            stop.get(
                "stop_id",
                ""
            )
        ).strip()


        if stop_id:

            stops_by_id[
                stop_id
            ] = stop


        stops_by_sequence[
            index
        ] = stop


    # ========================================================
    # PROCESSAR CADA ACTUALITZACIÓ
    # ========================================================

    for stop_update in stop_updates:

        stop_id = str(
            stop_update.get(
                "stopId",
                ""
            )
        ).strip()


        stop = None


        # ----------------------------------------------------
        # BUSCAR PER STOP ID
        # ----------------------------------------------------

        if stop_id:

            stop = stops_by_id.get(
                stop_id
            )


        # ----------------------------------------------------
        # SI NO TROBEM PER ID,
        # BUSCAR PER SEQÜÈNCIA
        # ----------------------------------------------------

        stop_sequence = (
            stop_update.get(
                "stopSequence"
            )
        )


        if (
            stop is None
            and stop_sequence is not None
        ):

            try:

                sequence = int(
                    stop_sequence
                )


                stop = (
                    stops_by_sequence.get(
                        sequence - 1
                    )
                )


            except Exception:

                stop = None


        # ----------------------------------------------------
        # NO TROBADA
        # ----------------------------------------------------

        if stop is None:

            print(
                "  ⚠️ Parada no trobada:",
                stop_id
            )

            continue


        # ====================================================
        # ARRIBADA / SORTIDA
        # ====================================================

        arrival = stop_update.get(
            "arrival"
        )


        departure = stop_update.get(
            "departure"
        )


        # Preferim arrival si existeix.
        # Si no, departure.

        event = None
        event_type = None


        if arrival is not None:

            event = arrival
            event_type = "arrival"


        elif departure is not None:

            event = departure
            event_type = "departure"


        if event is None:

            continue


        # ====================================================
        # RETARD
        # ====================================================

        delay_seconds = event.get(
            "delay"
        )


        if delay_seconds is None:

            delay_seconds = 0


        try:

            delay_seconds = int(
                delay_seconds
            )

        except Exception:

            delay_seconds = 0


        delay_minutes = round(
            delay_seconds / 60
        )


        # ====================================================
        # HORA REAL / PREVISTA DEL FEED
        # ====================================================

        timestamp = event.get(
            "time"
        )


        actual_minutes = (
            timestamp_a_minuts(
                timestamp
            )
        )


        actual_iso = (
            timestamp_a_iso(
                timestamp
            )
        )


        # ====================================================
        # IMPORTANT:
        #
        # Si Renfe dona "time", NO SUMEM el delay.
        #
        # El timestamp ja representa l'hora
        # de l'esdeveniment.
        #
        # Només fem:
        #
        # horari + retard
        #
        # si NO tenim timestamp.
        # ====================================================

        if actual_minutes is None:

            scheduled = stop.get(
                "scheduled_arrival"
            )


            if scheduled is not None:

                try:

                    actual_minutes = (
                        int(scheduled)
                        + delay_minutes
                    )

                except Exception:

                    actual_minutes = None


        # ====================================================
        # GUARDAR DADES
        # ====================================================

        if actual_minutes is not None:

            stop[
                "actual_minutes"
            ] = actual_minutes


        stop[
            "delay_seconds"
        ] = delay_seconds


        stop[
            "delay_minutes"
        ] = delay_minutes


        if actual_iso is not None:

            stop[
                "actual_time"
            ] = actual_iso


        stop[
            "realtime_event"
        ] = event_type


        # Guardem també el moment en què
        # nosaltres hem capturat aquesta dada.

        stop[
            "realtime_captured_at"
        ] = datetime.now(
            MADRID_TZ
        ).isoformat()


        parades_actualitzades += 1


        print(
            "  ✓",
            stop.get(
                "station",
                ""
            ),
            "→",
            (
                f"{actual_minutes // 60:02d}:"
                f"{actual_minutes % 60:02d}"
                if actual_minutes is not None
                else "--:--"
            ),
            "retard:",
            (
                f"{delay_minutes:+d}"
                if delay_minutes != 0
                else "0"
            ),
            "min"
        )


    # ========================================================
    # RETARD FINAL
    # ========================================================

    if stops:

        ultima = stops[-1]


        scheduled_final = (
            ultima.get(
                "scheduled_arrival"
            )
        )


        actual_final = (
            ultima.get(
                "actual_minutes"
            )
        )


        if (
            scheduled_final is not None
            and actual_final is not None
        ):

            train[
                "final_delay_minutes"
            ] = (
                actual_final
                - scheduled_final
            )


    # ========================================================
    # EL TREN TÉ INFORMACIÓ REALTIME
    # ========================================================

    train[
        "started"
    ] = True


# ============================================================
# METADADES
# ============================================================

dades[
    "realtime_updated_at"
] = datetime.now(
    MADRID_TZ
).isoformat()


dades[
    "realtime_source"
] = GTFS_RT_URL


# ============================================================
# GUARDAR
# ============================================================

with open(
    fitxer,
    "w",
    encoding="utf-8"
) as f:

    json.dump(
        dades,
        f,
        ensure_ascii=False,
        indent=2
    )


# ============================================================
# RESUM
# ============================================================

print()
print("==========================================")
print(
    "Trips R15 actualitzats:",
    actualitzats
)
print(
    "Parades actualitzades:",
    parades_actualitzades
)
print(
    "Fitxer actualitzat:",
    fitxer
)
print("==========================================")
print("FI REALTIME")
print("==========================================")
