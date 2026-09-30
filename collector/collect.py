import requests
import zipfile
import io
import csv
from collections import defaultdict

print("=== ANALITZANT CIRCULACIONS R15 ===")

GTFS_API = "https://data.renfe.com/api/3/action/package_show?id=horarios-cercanias"


def descarregar_gtfs():

    resposta = requests.get(GTFS_API)
    resposta.raise_for_status()

    dades = resposta.json()

    for recurs in dades["result"]["resources"]:

        if recurs.get("format", "").upper() == "GTFS":

            print("Descarregant GTFS oficial...")
            
            resposta = requests.get(recurs["url"])
            resposta.raise_for_status()

            return zipfile.ZipFile(
                io.BytesIO(resposta.content)
            )

    raise Exception("No s'ha trobat el GTFS")


def llegir(zip_gtfs, nom):

    with zip_gtfs.open(nom) as f:

        return list(
            csv.DictReader(
                io.TextIOWrapper(
                    f,
                    encoding="utf-8-sig"
                )
            )
        )


def main():

    gtfs = descarregar_gtfs()

    print("Llegint dades...")

    routes = llegir(gtfs, "routes.txt")
    trips = llegir(gtfs, "trips.txt")
    stop_times = llegir(gtfs, "stop_times.txt")
    stops = llegir(gtfs, "stops.txt")

    # -----------------------------------------
    # ESTACIONS
    # -----------------------------------------

    stop_names = {}

    for stop in stops:

        stop_names[
            stop["stop_id"]
        ] = stop.get(
            "stop_name",
            ""
        ).strip()

    # -----------------------------------------
    # ROUTES R15
    # -----------------------------------------

    r15_routes = set()

    for route in routes:

        if route.get(
            "route_short_name",
            ""
        ).strip() == "R15":

            r15_routes.add(
                route["route_id"]
            )

    print()
    print(
        "Routes R15:",
        len(r15_routes)
    )

    # -----------------------------------------
    # TRIPS R15
    # -----------------------------------------

    r15_trips = []

    for trip in trips:

        if trip.get(
            "route_id"
        ) in r15_routes:

            r15_trips.append(trip)

    print(
        "Trips R15:",
        len(r15_trips)
    )

    # -----------------------------------------
    # STOP TIMES
    # -----------------------------------------

    r15_trip_ids = {
        trip["trip_id"]
        for trip in r15_trips
    }

    parades = defaultdict(list)

    for stop_time in stop_times:

        trip_id = stop_time["trip_id"]

        if trip_id not in r15_trip_ids:
            continue

        stop_id = stop_time["stop_id"]

        nom = stop_names.get(
            stop_id,
            stop_id
        )

        parades[trip_id].append({

            "sequence": int(
                stop_time[
                    "stop_sequence"
                ]
            ),

            "station": nom,

            "arrival": stop_time.get(
                "arrival_time",
                ""
            ),

            "departure": stop_time.get(
                "departure_time",
                ""
            )
        })

    # -----------------------------------------
    # ORDENAR PARADES
    # -----------------------------------------

    for trip_id in parades:

        parades[trip_id].sort(
            key=lambda x:
                x["sequence"]
        )

    # -----------------------------------------
    # BUSCAR REUS
    # -----------------------------------------

    print()
    print(
        "======================================"
    )
    print(
        "CIRCULACIONS R15 QUE PASSEN PER REUS"
    )
    print(
        "======================================"
    )

    total = 0

    for trip in r15_trips:

        trip_id = trip["trip_id"]

        stops_trip = parades.get(
            trip_id,
            []
        )

        if not stops_trip:
            continue

        reus_index = None

        for i, parada in enumerate(
            stops_trip
        ):

            if "REUS" in parada[
                "station"
            ].upper():

                reus_index = i
                break

        if reus_index is None:
            continue

        total += 1

        primera = stops_trip[0]
        ultima = stops_trip[-1]
        reus = stops_trip[reus_index]

        print()
        print(
            f"TRIP: {trip_id}"
        )

        print(
            f"ROUTE: {trip['route_id']}"
        )

        print(
            f"SERVICE: "
            f"{trip.get('service_id', '')}"
        )

        print(
            f"ORIGEN: "
            f"{primera['station']} "
            f"{primera['departure']}"
        )

        print(
            f"REUS: "
            f"{reus['arrival']} → "
            f"{reus['departure']}"
        )

        print(
            f"DESTÍ: "
            f"{ultima['station']} "
            f"{ultima['arrival']}"
        )

    print()
    print(
        "======================================"
    )

    print(
        "TOTAL CIRCULACIONS R15 PER REUS:",
        total
    )


if __name__ == "__main__":

    main()
