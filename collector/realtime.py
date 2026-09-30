```python
import requests
import json
import os
from datetime import datetime, date


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
# COMPROVAR FITXER DEL DIA
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
# DESCARREGAR FEED JSON DE RENFE
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


print(
    "Feed descarregat:",
    len(response.content),
    "bytes"
)


# ============================================================
# PARSEJAR JSON
# ============================================================

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


print(
    "JSON carregat correctament."
)


# ============================================================
# INFORMACIÓ DEL FEED
# ============================================================

header = feed.get(
    "header",
    {}
)


print(
    "Versió GTFS-RT:",
    header.get(
        "gtfs_realtime_version",
        "desconeguda"
    )
)


# ============================================================
# ENTITATS
# ============================================================

entities = feed.get(
    "entity",
    []
)


print(
    "Entitats:",
    len(entities)
)


# ============================================================
# BUSCAR TRIPS EN TEMPS REAL
# ============================================================

realtime_trips = {}


for entity in entities:

    trip_update = entity.get(
        "trip_update"
    )


    if not trip_update:

        continue


    trip = trip_update.get(
        "trip",
        {}
    )


    trip_id = str(
        trip.get(
            "trip_id",
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
# ACTUALITZAR TRENS R15
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


    if trip_id not in realtime_trips:

        continue


    trip_update = (
        realtime_trips[
            trip_id
        ]
    )


    actualitzats += 1


    # --------------------------------------------------------
    # ESTAT DEL VIATGE
    # --------------------------------------------------------

    schedule_relationship = (
        trip_update
        .get(
            "trip",
            {}
        )
        .get(
            "schedule_relationship"
        )
    )


    if schedule_relationship:

        train[
            "schedule_relationship"
        ] = schedule_relationship


    # --------------------------------------------------------
    # ACTUALITZACIONS DE PARADES
    # --------------------------------------------------------

    stop_updates = (
        trip_update.get(
            "stop_time_update",
            []
        )
    )


    # Índex de les nostres parades
    # tant per stop_id com per seqüència.

    stops_by_id = {}

    stops_by_sequence = {}


    for index, stop in enumerate(
        train.get(
            "stops",
            []
        )
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


        # El collector no guarda
        # actualment stop_sequence
        # al JSON final.
        #
        # Per tant, l'índex serveix
        # com a alternativa si Renfe
        # proporciona stop_sequence.

        stops_by_sequence[
            index
        ] = stop


    # --------------------------------------------------------
    # PROCESSAR ACTUALITZACIONS
    # --------------------------------------------------------

    for stop_update in stop_updates:

        stop_id = str(
            stop_update.get(
                "stop_id",
                ""
            )
        ).strip()


        stop_sequence = (
            stop_update.get(
                "stop_sequence"
            )
        )


        stop = None


        # Primer intent:
        # stop_id

        if stop_id:

            stop = stops_by_id.get(
                stop_id
            )


        # Segon intent:
        # stop_sequence

        if (
            stop is None
            and
            stop_sequence is not None
        ):

            try:

                sequence_index = (
                    int(
                        stop_sequence
                    ) - 1
                )

                stop = (
                    stops_by_sequence.get(
                        sequence_index
                    )
                )

            except Exception:

                stop = None


        if stop is None:

            continue


        # ----------------------------------------------------
        # ARRIBADA / SORTIDA
        # ----------------------------------------------------

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


        if arrival:

            event = arrival

        elif departure:

            event = departure


        if not event:

            continue


        # ----------------------------------------------------
        # RETARD
        # ----------------------------------------------------

        delay_seconds = event.get(
            "delay"
        )


        # Si Renfe proporciona
        # directament l'hora prevista,
        # la utilitzem.

        actual_timestamp = event.get(
            "time"
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


        scheduled = (
            stop.get(
                "scheduled_arrival"
            )
        )


        # ----------------------------------------------------
        # CALCULAR HORA REAL
        # ----------------------------------------------------

        if actual_timestamp is not None:

            try:

                actual_timestamp = int(
                    actual_timestamp
                )

                dt = datetime.fromtimestamp(
                    actual_timestamp
                )

                actual_minutes = (
                    dt.hour * 60
                    +
                    dt.minute
                )

                stop[
                    "actual_minutes"
                ] = actual_minutes

            except Exception:

                if scheduled is not None:

                    stop[
                        "actual_minutes"
                    ] = (
                        scheduled
                        +
                        delay_minutes
                    )

        elif scheduled is not None:

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


    # ========================================================
    # RETARD FINAL
    # ========================================================

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


    # ========================================================
    # MARCAR TREBALLANT EN TEMPS REAL
    # ========================================================

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
```
