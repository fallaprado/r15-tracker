```python
import requests
import zipfile
import io
import csv
import json
import os
from datetime import datetime, date


GTFS_URL = (
    "https://ssl.renfe.com/ftransit/"
    "Fichero_CER_FOMENTO/fomento_transit.zip"
)

DATA_DIR = "data"

R15_ROUTES = {
    "51T0124R15",
    "51T0125R15",
    "51T0126R15",
    "51T0127R15",
    "51T0128R15",
    "51T0129R15",
    "51T0130R15",
    "51T0131R15",
    "51T0132R15",
    "51T0133R15",
    "51T0134R15",
    "51T0135R15",
}


# ============================================================
# DATA
# ============================================================

today = date.today()

output_file = os.path.join(
    DATA_DIR,
    f"{today.isoformat()}.json"
)

os.makedirs(
    DATA_DIR,
    exist_ok=True
)


print("==========================================")
print("R15 COLLECTOR")
print("Data:", today)
print("==========================================")


# ============================================================
# DESCARREGAR GTFS
# ============================================================

print(
    "Descarregant GTFS de Renfe..."
)

response = requests.get(
    GTFS_URL,
    timeout=60,
    headers={
        "User-Agent": "R15-Tracker/1.0"
    }
)

response.raise_for_status()

print(
    "Fitxer descarregat:",
    len(response.content),
    "bytes"
)


# ============================================================
# OBRIR ZIP
# ============================================================

zip_file = zipfile.ZipFile(
    io.BytesIO(response.content)
)


files = zip_file.namelist()

print(
    "Fitxers GTFS:",
    len(files)
)


# ============================================================
# FUNCIONS
# ============================================================

def read_csv(filename):

    with zip_file.open(
        filename
    ) as f:

        text = io.TextIOWrapper(
            f,
            encoding="utf-8-sig"
        )

        return list(
            csv.DictReader(text)
        )


def minutes_from_gtfs_time(value):

    if not value:
        return None

    try:

        parts = value.strip().split(":")

        if len(parts) != 3:
            return None

        hours = int(parts[0])
        minutes = int(parts[1])

        return (
            hours * 60
            + minutes
        )

    except Exception:

        return None


def clean(value):

    if value is None:
        return ""

    return str(value).strip()


# ============================================================
# CARREGAR TAULES
# ============================================================

print(
    "Carregant routes.txt..."
)

routes = read_csv(
    "routes.txt"
)


print(
    "Carregant trips.txt..."
)

trips = read_csv(
    "trips.txt"
)


print(
    "Carregant stop_times.txt..."
)

stop_times = read_csv(
    "stop_times.txt"
)


print(
    "Carregant stops.txt..."
)

stops = read_csv(
    "stops.txt"
)


# ============================================================
# INDEXAR STOPS
# ============================================================

stops_by_id = {}

for stop in stops:

    stop_id = clean(
        stop.get(
            "stop_id"
        )
    )

    if stop_id:

        stops_by_id[
            stop_id
        ] = stop


# ============================================================
# IDENTIFICAR RUTES R15
# ============================================================

r15_routes = set()


for route in routes:

    route_id = clean(
        route.get(
            "route_id"
        )
    )


    route_short_name = clean(
        route.get(
            "route_short_name"
        )
    )


    route_long_name = clean(
        route.get(
            "route_long_name"
        )
    )


    text = (
        route_id
        + " "
        + route_short_name
        + " "
        + route_long_name
    ).upper()


    if (
        "R15" in text
        or route_id in R15_ROUTES
    ):

        r15_routes.add(
            route_id
        )


print(
    "Rutes R15:",
    len(r15_routes)
)


# ============================================================
# IDENTIFICAR TRIPS R15
# ============================================================

r15_trips = []


for trip in trips:

    route_id = clean(
        trip.get(
            "route_id"
        )
    )


    if route_id not in r15_routes:
        continue


    r15_trips.append(
        trip
    )


print(
    "Trips R15 totals:",
    len(r15_trips)
)


# ============================================================
# INDEXAR STOP TIMES
# ============================================================

stop_times_by_trip = {}


for row in stop_times:

    trip_id = clean(
        row.get(
            "trip_id"
        )
    )


    if not trip_id:
        continue


    if trip_id not in stop_times_by_trip:

        stop_times_by_trip[
            trip_id
        ] = []


    stop_times_by_trip[
        trip_id
    ].append(
        row
    )


# ============================================================
# FUNCIÓ PER DETERMINAR SENTIT
# ============================================================

def determine_direction(
    trip_stops
):

    if not trip_stops:
        return None


    first_stop_id = clean(
        trip_stops[0].get(
            "stop_id"
        )
    )


    last_stop_id = clean(
        trip_stops[-1].get(
            "stop_id"
        )
    )


    first_stop = stops_by_id.get(
        first_stop_id,
        {}
    )


    last_stop = stops_by_id.get(
        last_stop_id,
        {}
    )


    first_name = (
        first_stop.get(
            "stop_name",
            ""
        )
        or ""
    ).lower()


    last_name = (
        last_stop.get(
            "stop_name",
            ""
        )
        or ""
    ).lower()


    # Barcelona -> Reus

    if (
        "barcelona" in first_name
        and "reus" in last_name
    ):

        return "BAR_REUS"


    # Reus -> Barcelona

    if (
        "reus" in first_name
        and "barcelona" in last_name
    ):

        return "REUS_BAR"


    # Fallback basat en el primer/últim stop
    # si Renfe utilitza noms lleugerament diferents.

    if "reus" in last_name:

        return "BAR_REUS"


    if "reus" in first_name:

        return "REUS_BAR"


    return None


# ============================================================
# CREAR CIRCULACIONS
# ============================================================

trains = []

stop_times_r15_count = 0


for trip in r15_trips:

    trip_id = clean(
        trip.get(
            "trip_id"
        )
    )


    if not trip_id:
        continue


    trip_stop_times = (
        stop_times_by_trip.get(
            trip_id,
            []
        )
    )


    if not trip_stop_times:
        continue


    # Ordenar per stop_sequence

    trip_stop_times.sort(
        key=lambda x: int(
            x.get(
                "stop_sequence",
                0
            )
        )
    )


    stop_times_r15_count += len(
        trip_stop_times
    )


    direction = determine_direction(
        trip_stop_times
    )


    if direction is None:
        continue


    # --------------------------------------------------------
    # PARADES
    # --------------------------------------------------------

    train_stops = []


    for stop_time in trip_stop_times:

        stop_id = clean(
            stop_time.get(
                "stop_id"
            )
        )


        stop_info = stops_by_id.get(
            stop_id,
            {}
        )


        station_name = clean(
            stop_info.get(
                "stop_name"
            )
        )


        arrival = minutes_from_gtfs_time(
            stop_time.get(
                "arrival_time"
            )
        )


        departure = minutes_from_gtfs_time(
            stop_time.get(
                "departure_time"
            )
        )


        try:

            sequence = int(
                stop_time.get(
                    "stop_sequence",
                    0
                )
            )

        except Exception:

            sequence = 0


        train_stops.append({

            "station": station_name,

            "stop_id": stop_id,

            "sequence": sequence,

            "scheduled_arrival": arrival,

            "scheduled_departure": departure,

            "actual_minutes": None

        })


    if not train_stops:
        continue


    # --------------------------------------------------------
    # SORT PARADES
    # --------------------------------------------------------

    train_stops.sort(
        key=lambda x: x.get(
            "sequence",
            0
        )
    )


    first_stop = train_stops[0]

    last_stop = train_stops[-1]


    departure_minutes = (
        first_stop.get(
            "scheduled_departure"
        )
    )


    arrival_minutes = (
        last_stop.get(
            "scheduled_arrival"
        )
    )


    # --------------------------------------------------------
    # SERVICE ID
    # --------------------------------------------------------

    service_id = clean(
        trip.get(
            "service_id"
        )
    )


    # --------------------------------------------------------
    # CREAR TRAIN
    # --------------------------------------------------------

    train = {

        "train_id": trip_id,

        "route_id": clean(
            trip.get(
                "route_id"
            )
        ),

        "service_id": service_id,

        "direction": direction,

        "departure": departure_minutes,

        "arrival": arrival_minutes,

        "started": False,

        "arrived": False,

        "final_delay_minutes": 0,

        "has_realtime": False,

        "stops": train_stops

    }


    trains.append(
        train
    )


# ============================================================
# ORDENAR TRENS
# ============================================================

trains.sort(
    key=lambda x: (
        x.get(
            "direction",
            ""
        ),
        x.get(
            "departure"
        )
        if x.get(
            "departure"
        ) is not None
        else 9999
    )
)


# ============================================================
# GUARDAR
# ============================================================

output = {

    "date": today.isoformat(),

    "generated_at": datetime.now().isoformat(),

    "source": GTFS_URL,

    "trains": trains

}


with open(
    output_file,
    "w",
    encoding="utf-8"
) as f:

    json.dump(
        output,
        f,
        ensure_ascii=False,
        indent=2
    )


# ============================================================
# RESUM
# ============================================================

bar_reus = sum(
    1
    for train in trains
    if train.get(
        "direction"
    ) == "BAR_REUS"
)

reus_bar = sum(
    1
    for train in trains
    if train.get(
        "direction"
    ) == "REUS_BAR"
)


print()
print("==========================================")
print(
    "Rutes R15:",
    len(r15_routes)
)
print(
    "Trips R15:",
    len(r15_trips)
)
print(
    "Stop_times R15:",
    stop_times_r15_count
)
print(
    "Circulacions R15:",
    len(trains)
)
print(
    "Barcelona → Reus:",
    bar_reus
)
print(
    "Reus → Barcelona:",
    reus_bar
)
print(
    "Fitxer:",
    output_file
)
print("==========================================")
print("FI COLLECTOR")
print("==========================================")
```
