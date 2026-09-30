import requests
import json
import os
from datetime import datetime, date


# ============================================================
# CONFIGURACIÓ
# ============================================================

GTFS_RT_URL = "https://gtfsrt.renfe.com/trip_updates.json"

DATA_DIR = "data"


# ============================================================
# DATA ACTUAL
# ============================================================

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
# COMPROVAR JSON DIARI
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
    "Descarregant dades en temps real..."
)


response = requests.get(
    GTFS_RT_URL,
    timeout=30
)


response.raise_for_status()


print(
    "GTFS-RT descarregat."
)


# ============================================================
# COMPROVAR CONTINGUT
# ============================================================

print()
print(
    "Analitzant trips..."
)


# El feed és GTFS-RT protobuf.
#
# Per llegir-lo necessitem:
#
#   gtfs-realtime-bindings
#
# Aquest script assumeix que està instal·lat.


from google.transit import gtfs_realtime_pb2


feed = gtfs_realtime_pb2.FeedMessage()

feed.ParseFromString(
    response.content
)


print(
    "Entitats:",
    len(feed.entity)
)


# ============================================================
# INDEXAR TRIPS REALS
# ============================================================

realtime_trips = {}


for entity in feed.entity:

    if not entity.HasField(
        "trip_update"
    ):

        continue


    trip_update = entity.trip_update


    if not trip_update.HasField(
        "trip"
    ):

        continue


    trip_id = (
        trip_update.trip.trip_id
    )


    if not trip_id:

        continue


    # Guardem tota la informació
    # del trip.


    realtime_trips[
        trip_id
    ] = trip_update


print(
    "Trips amb informació:",
    len(realtime_trips)
)


# ============================================================
# ACTUALITZAR ELS NOSTRES R15
# ============================================================

actualitzats = 0


for train in dades["trains"]:


    trip_id = train["train_id"]


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
            stop_update.stop_id
        )


        # Buscar la parada corresponent
        # al nostre JSON.


        for stop in train["stops"]:


            if (
                stop.get(
                    "stop_id"
                )
                != stop_id
            ):

                continue


            # ------------------------------------------------
            # RETARD
            # ------------------------------------------------

            if stop_update.HasField(
                "arrival"
            ):

                delay = (
                    stop_update.arrival.delay
                )

            elif stop_update.HasField(
                "departure"
            ):

                delay = (
                    stop_update.departure.delay
                )

            else:

                continue


            # GTFS-RT dona el retard
            # en segons.


            scheduled = (
                stop.get(
                    "scheduled_arrival"
                )
            )


            if scheduled is not None:

                actual = (
                    scheduled
                    +
                    round(
                        delay / 60
                    )
                )


                stop[
                    "actual_minutes"
                ] = actual


            stop[
                "delay_seconds"
            ] = delay


            break


    # --------------------------------------------------------
    # RETARD FINAL
    # --------------------------------------------------------

    if train["stops"]:

        ultima = (
            train["stops"][-1]
        )


        if (
            ultima.get(
                "actual_minutes"
            )
            is not None
            and
            ultima.get(
                "scheduled_arrival"
            )
            is not None
        ):

            train[
                "final_delay_minutes"
            ] = (
                ultima[
                    "actual_minutes"
                ]
                -
                ultima[
                    "scheduled_arrival"
                ]
            )


    # --------------------------------------------------------
    # ESTAT
    # --------------------------------------------------------

    train[
        "started"
    ] = True


print()
print(
    "Trens R15 actualitzats:",
    actualitzats
)


# ============================================================
# GUARDAR
# ============================================================

dades[
    "realtime_updated_at"
] = (
    datetime.now()
    .astimezone()
    .isoformat()
)


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


print()
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
