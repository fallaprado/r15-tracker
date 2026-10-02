```python
import requests
import json
import os
from datetime import datetime, date, timezone
from zoneinfo import ZoneInfo


GTFS_RT_URL = "https://gtfsrt.renfe.com/trip_updates.json"
DATA_DIR = "data"

MADRID_TZ = ZoneInfo("Europe/Madrid")

avui = date.today()

fitxer = os.path.join(
    DATA_DIR,
    f"{avui.isoformat()}.json"
)


print("==========================================")
print("R15 REALTIME")
print("Data:", avui)
print("==========================================")


if not os.path.exists(fitxer):

    raise Exception(
        f"No existeix el fitxer {fitxer}"
    )


# ============================================================
# CARREGAR JSON DEL DIA
# ============================================================

with open(
    fitxer,
    "r",
    encoding="utf-8"
) as f:

    dades = json.load(f)


print(
    "Carregant:",
    fitxer
)


# ============================================================
# DESCARREGAR GTFS-RT
# ============================================================

print(
    "Descarregant GTFS-RT de Renfe..."
)


response = requests.get(
    GTFS_RT_URL,
    timeout=30,
    headers={
        "User-Agent": "R15-Tracker/1.0"
    }
)


response.raise_for_status()


feed = response.json()


entities = feed.get(
    "entity",
    []
)


print(
    "Entitats:",
    len(entities)
)


# ============================================================
# CREAR DICCIONARI DE TRIPS
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
# FUNCIONS
# ============================================================

def timestamp_a_datetime(timestamp):

    if timestamp is None:
        return None


    try:

        timestamp = int(
            timestamp
        )


        dt_utc = datetime.fromtimestamp(
            timestamp,
            tz=timezone.utc
        )


        return dt_utc.astimezone(
            MADRID_TZ
        )


    except Exception:

        return None


def timestamp_a_iso(timestamp):

    dt = timestamp_a_datetime(
        timestamp
    )


    if dt is None:
        return None


    return dt.isoformat()


def timestamp_a_minuts(timestamp):

    dt = timestamp_a_datetime(
        timestamp
    )


    if dt is None:
        return None


    return (
        dt.hour * 60
        + dt.minute
    )


def minuts_a_hora(minuts):

    if minuts is None:
        return "--:--"


    minuts = int(
        minuts
    )


    minuts = minuts % 1440


    hores = minuts // 60

    minuts_restants = minuts % 60


    return (
        f"{hores:02d}:"
        f"{minuts_restants:02d}"
    )


def calcular_retard_seconds(
    scheduled_minutes,
    actual_minutes
):

    if (
        scheduled_minutes is None
        or actual_minutes is None
    ):

        return None


    try:

        return (
            int(actual_minutes)
            - int(scheduled_minutes)
        ) * 60


    except Exception:

        return None


# ============================================================
# ACTUALITZAR TRENS
# ============================================================

actualitzats = 0

parades_actualitzades = 0

parades_propagades = 0


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
    # INFORMACIÓ DEL TRIP
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
    # TIMESTAMP
    # ========================================================

    trip_timestamp = (
        trip_update.get(
            "timestamp"
        )
    )


    if trip_timestamp is not None:

        train[
            "realtime_timestamp"
        ] = int(
            trip_timestamp
        )


        train[
            "realtime_updated_at"
        ] = timestamp_a_iso(
            trip_timestamp
        )


    # ========================================================
    # RETARD GENERAL
    # ========================================================

    trip_delay = trip_update.get(
        "delay"
    )


    if trip_delay is not None:

        try:

            trip_delay = int(
                trip_delay
            )

        except Exception:

            trip_delay = None


    train[
        "realtime_trip_delay_seconds"
    ] = trip_delay


    if trip_delay is not None:

        train[
            "realtime_trip_delay_minutes"
        ] = round(
            trip_delay / 60
        )


    # ========================================================
    # STOP TIME UPDATES
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
    # ORDENAR PARADES
    # ========================================================

    stops.sort(
        key=lambda x: int(
            x.get(
                "sequence",
                0
            )
        )
    )


    # ========================================================
    # INDEX PER STOP_ID
    # ========================================================

    stops_by_id = {}


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
            ] = index


    # ========================================================
    # CONVERTIR UPDATES A ÍNDEX
    # ========================================================

    updates_by_index = {}


    for stop_update in stop_updates:

        stop_id = str(
            stop_update.get(
                "stopId",
                ""
            )
        ).strip()


        index = None


        if stop_id in stops_by_id:

            index = stops_by_id[
                stop_id
            ]


        else:

            stop_sequence = (
                stop_update.get(
                    "stopSequence"
                )
            )


            if stop_sequence is not None:

                try:

                    sequence = int(
                        stop_sequence
                    )


                    index = sequence - 1


                except Exception:

                    index = None


        if index is None:
            continue


        if (
            index < 0
            or index >= len(stops)
        ):

            continue


        updates_by_index[
            index
        ] = stop_update


    # ========================================================
    # PROPAGAR RETARD
    # ========================================================

    retard_actual = None


    for index, stop in enumerate(
        stops
    ):

        stop_update = (
            updates_by_index.get(
                index
            )
        )


        # ====================================================
        # ACTUALITZACIÓ DIRECTA
        # ====================================================

        if stop_update is not None:

            arrival = (
                stop_update.get(
                    "arrival"
                )
            )


            departure = (
                stop_update.get(
                    "departure"
                )
            )


            event = None

            event_type = None


            # ------------------------------------------------
            # Preferim arrival
            # ------------------------------------------------

            if arrival is not None:

                event = arrival

                event_type = "arrival"


            elif departure is not None:

                event = departure

                event_type = "departure"


            if event is not None:

                # ============================================
                # DELAY
                # ============================================

                delay_seconds = (
                    event.get(
                        "delay"
                    )
                )


                if delay_seconds is not None:

                    try:

                        delay_seconds = int(
                            delay_seconds
                        )

                    except Exception:

                        delay_seconds = None


                # ============================================
                # TIME
                # ============================================

                timestamp = (
                    event.get(
                        "time"
                    )
                )


                actual_minutes = (
                    timestamp_a_minuts(
                        timestamp
                    )
                )


                # ============================================
                # SI NO TENIM DELAY PERÒ TENIM TIME,
                # CALCULEM EL RETARD
                # ============================================

                if (
                    delay_seconds is None
                    and actual_minutes is not None
                ):

                    scheduled = (
                        stop.get(
                            "scheduled_arrival"
                        )
                    )


                    if scheduled is None:

                        scheduled = (
                            stop.get(
                                "scheduled_departure"
                            )
                        )


                    delay_seconds = (
                        calcular_retard_seconds(
                            scheduled,
                            actual_minutes
                        )
                    )


                # ============================================
                # HORA REAL / ESTIMADA
                # ============================================

                if actual_minutes is not None:

                    stop[
                        "actual_minutes"
                    ] = actual_minutes


                    stop[
                        "actual_time"
                    ] = timestamp_a_iso(
                        timestamp
                    )


                    event_dt = (
                        timestamp_a_datetime(
                            timestamp
                        )
                    )


                    if event_dt is not None:

                        ara = datetime.now(
                            MADRID_TZ
                        )


                        if event_dt <= ara:

                            stop[
                                "realtime_type"
                            ] = "real"

                        else:

                            stop[
                                "realtime_type"
                            ] = "estimated"


                # ============================================
                # RETARD
                # ============================================

                if delay_seconds is not None:

                    retard_actual = (
                        delay_seconds
                    )


                    stop[
                        "delay_seconds"
                    ] = delay_seconds


                    stop[
                        "delay_minutes"
                    ] = round(
                        delay_seconds / 60
                    )


                # ============================================
                # METADADES
                # ============================================

                stop[
                    "realtime_event"
                ] = event_type


                if trip_timestamp is not None:

                    stop[
                        "realtime_captured_at"
                    ] = timestamp_a_iso(
                        trip_timestamp
                    )

                else:

                    stop[
                        "realtime_captured_at"
                    ] = datetime.now(
                        MADRID_TZ
                    ).isoformat()


                parades_actualitzades += 1


                # ============================================
                # LOG
                # ============================================

                actual = stop.get(
                    "actual_minutes"
                )


                if actual is not None:

                    hora = minuts_a_hora(
                        actual
                    )

                else:

                    hora = "--:--"


                retard = stop.get(
                    "delay_minutes",
                    0
                )


                print(
                    "  ✓",
                    stop.get(
                        "station",
                        ""
                    ),
                    "→",
                    hora,
                    "retard:",
                    f"{retard:+d}",
                    "min"
                )


        # ====================================================
        # SENSE ACTUALITZACIÓ DIRECTA
        # ====================================================

        elif retard_actual is not None:

            scheduled = (
                stop.get(
                    "scheduled_arrival"
                )
            )


            if scheduled is None:

                scheduled = (
                    stop.get(
                        "scheduled_departure"
                    )
                )


            if scheduled is None:
                continue


            try:

                retard_minuts = round(
                    retard_actual / 60
                )


                estimated = (
                    int(scheduled)
                    + retard_minuts
                )


                # ------------------------------------------------
                # HORA ESTIMADA
                # ------------------------------------------------

                stop[
                    "actual_minutes"
                ] = estimated


                stop[
                    "delay_seconds"
                ] = retard_actual


                stop[
                    "delay_minutes"
                ] = retard_minuts


                stop[
                    "realtime_type"
                ] = "estimated_propagated"


                stop[
                    "realtime_event"
                ] = "propagated"


                if trip_timestamp is not None:

                    stop[
                        "realtime_captured_at"
                    ] = timestamp_a_iso(
                        trip_timestamp
                    )

                else:

                    stop[
                        "realtime_captured_at"
                    ] = datetime.now(
                        MADRID_TZ
                    ).isoformat()


                parades_propagades += 1


                print(
                    "  ↳",
                    stop.get(
                        "station",
                        ""
                    ),
                    "→",
                    minuts_a_hora(
                        estimated
                    ),
                    "estimada",
                    "retard:",
                    f"{retard_minuts:+d}",
                    "min"
                )


            except Exception:

                pass


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


        if scheduled_final is None:

            scheduled_final = (
                ultima.get(
                    "scheduled_departure"
                )
            )


        actual_final = (
            ultima.get(
                "actual_minutes"
            )
        )


        # ----------------------------------------------------
        # TENIM HORA REAL / ESTIMADA FINAL
        # ----------------------------------------------------

        if (
            scheduled_final is not None
            and actual_final is not None
        ):

            try:

                train[
                    "final_delay_minutes"
                ] = (
                    int(actual_final)
                    - int(scheduled_final)
                )


            except Exception:

                pass


        # ----------------------------------------------------
        # SI NO TENIM ACTUAL PERÒ TENIM RETARD
        # ----------------------------------------------------

        elif retard_actual is not None:

            train[
                "final_delay_minutes"
            ] = round(
                retard_actual / 60
            )


    # ========================================================
    # MARCAR REALTIME
    # ========================================================

    train[
        "has_realtime"
    ] = True


# ============================================================
# INFORMACIÓ GENERAL
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

print(
    "=========================================="
)

print(
    "Trips R15 actualitzats:",
    actualitzats
)

print(
    "Parades amb actualització directa:",
    parades_actualitzades
)

print(
    "Parades amb retard propagat:",
    parades_propagades
)

print(
    "Fitxer actualitzat:",
    fitxer
)

print(
    "=========================================="
)

print(
    "FI REALTIME"
)

print(
    "=========================================="
)
```
