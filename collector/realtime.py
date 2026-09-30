import requests
import json
import os
from datetime import datetime, date

from google.transit import gtfs_realtime_pb2


# ============================================================
# CONFIGURACIÓ
# ============================================================

GTFS_RT_URL = "https://gtfsrt.renfe.com/trip_updates.json"

DATA_DIR = "data"

avui = date.today()

fitxer = os.path.join(
    DATA_DIR,
    f"{avui.isoformat()}.json"
)


print("==========================================")
print("R15 REALTIME")
print("Data:", avui)
print("==========================================")


# ============================================================
# COMPROVAR JSON DEL DIA
# ============================================================

if not os.path.exists(fitxer):

    raise Exception(
        f"No existeix el fitxer {fitxer}"
    )


print(
    "Carregant:",
    fitxer
)


with open(
    fitxer,
    "r",
    encoding="utf-8"
) as f:

    dades = json.load(f)


# ============================================================
# DESCARREGAR GTFS-RT
# ============================================================

print(
    "Descarregant GTFS-RT de Renfe..."
)


response = requests.get(
    GTFS_RT_URL,
    timeout=30
)

response.raise_for_status()


print(
    "Feed descarregat:",
    len(response.content),
    "bytes"
)


# ============================================================
# PARSEJAR PROTOBUF
# ============================================================

feed = gtfs_realtime_pb2.FeedMessage()

feed.ParseFromString(
    response.content
)


print(
    "Entitats del feed:",
    len(feed.entity)
)


# ============================================================
# INDEXAR TRIPS EN TEMPS REAL
# ============================================================

realtime_trips = {}


for entity in feed.entity:

    if not entity.HasField(
        "trip_update"
    ):
        continue

    trip_update = (
        entity.trip_update
    )

    if not trip_update.HasField(
        "trip"
    ):
        continue

    trip_id = (
        trip_update.trip.trip_id.strip()
    )

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
# ACTUALITZAR NOMÉS ELS R15
# ============================================================

actualitzats = 0

parades_actualitzades = 0


for train in dades.get(
    "trains",
    []
):

    trip_id = (
        train.get(
            "train_id",
            ""
        ).strip()
    )

    if trip_id not in realtime_trips:

        continue


    trip_update = (
        realtime_trips[
            trip_id
        ]
    )


    actualitzats += 1


    # --------------------------------------------------------
    # PARADES
    # --------------------------------------------------------

    for stop_update in (
        trip_update.stop_time_update
    ):

        stop_id = (
            stop_update.stop_id.strip()
        )


        # Buscar la parada
        # corresponent al JSON.

        for stop in train.get(
            "stops",
            []
        ):

            if (
                stop.get(
                    "stop_id",
                    ""
                ).strip()
                != stop_id
            ):

                continue


            # ------------------------------------------------
            # RETARD
            # ------------------------------------------------

            delay_seconds = None


            if stop_update.HasField(
                "arrival"
            ):

                delay_seconds = (
                    stop_update.arrival.delay
                )

            elif stop_update.HasField(
                "departure"
            ):

                delay_seconds = (
                    stop_update.departure.delay
                )


            if delay_seconds is None:

                continue


            # ------------------------------------------------
            # CONVERTIR RETARD
            # ------------------------------------------------

            delay_minutes = round(
                delay_seconds / 60
            )


            scheduled = (
                stop.get(
                    "scheduled_arrival"
                )
            )


            if scheduled is not None:

                stop[
                    "actual_minutes"
                ] = (
                    scheduled
                    +
                    delay_minutes
                )


            stop[
                "delay_seconds"
            ] = delay_seconds


            stop[
                "delay_minutes"
            ] = delay_minutes


            parades_actualitzades += 1


            break


    # --------------------------------------------------------
    # CALCULAR RETARD FINAL
    # --------------------------------------------------------

    stops = train.get(
        "stops",
        []
    )


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
            and
            actual_final is not None
        ):

            train[
                "final_delay_minutes"
            ] = (
                actual_final
                -
                scheduled_final
            )


    # --------------------------------------------------------
    # MARCAR COM A INICIAT
    # --------------------------------------------------------

    train[
        "started"
    ] = True


# ============================================================
# INFORMACIÓ DE L'ACTUALITZACIÓ
# ============================================================

dades[
    "realtime_updated_at"
] = (
    datetime.now()
    .astimezone()
    .isoformat()
)


dades[
    "realtime_source"
] = (
    GTFS_RT_URL
)


# ============================================================
# GUARDAR JSON
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
    "Fitxer:",
    fitxer
)

print("==========================================")
print("FI REALTIME")
print("==========================================")
