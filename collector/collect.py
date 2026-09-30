import requests
import zipfile
import io
import csv
from collections import defaultdict
from datetime import date

print("=== R15 - CIRCULACIONS 1 OCTUBRE 2026 ===")

GTFS_API = "https://data.renfe.com/api/3/action/package_show?id=horarios-cercanias"

DATA = date(2026, 10, 1)


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

    raise Exception("No s'ha trobat el GTFS oficial")


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


def servei_actiu(service, data):

    inici = date.fromisoformat(
        service["start_date"]
    )

    final = date.fromisoformat(
        service["end_date"]
    )

    if not (
        inici <= data <= final
    ):
        return False

    dies = [
        "monday",
        "tuesday",
        "wednesday",
        "thursday",
        "friday",
        "saturday",
        "sunday"
    ]

    dia = dies[data.weekday()]

    return service.get(dia) == "1"


def main():

    gtfs = descarregar_gtfs()

    print("Llegint fitxers...")

    routes = llegir(
        gtfs,
        "routes.txt"
    )

    trips = llegir(
        gtfs,
        "trips.txt"
    )

    stop_times = llegir(
        gtfs,
        "stop_times.txt"
    )

    stops = llegir(
        gtfs,
        "stops.txt"
    )

    calendar = llegir(
        gtfs,
        "calendar.txt"
    )

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
    # RUTES R15
    # -----------------------------------------

    r15_routes = set()

    for route in routes:

        if route.get(
            "route_short_name",
            ""
        ).strip() == "R15":

            r15_routes.add(
                route["route_id"].strip()
            )

    print()
    print(
        "Routes R15:",
        len(r15_routes)
    )

    # -----------------------------------------
    # SERVEIS ACTIUS
    # -----------------------------------------

    serveis_actius = set()

    for service in calendar:

        if servei_actiu(
            service,
            DATA
        ):

            serveis_actius.add(
                service["service_id"]
            )

    print(
        "Serveis actius el",
        DATA,
        ":",
        len(serveis_actius)
    )

    # -----------------------------------------
    # TRIPS R15 DEL DIA
    # -----------------------------------------

    r15_trips = []

    for trip in trips:

        route_id = trip.get(
            "route_id",
            ""
        ).strip()

        service_id = trip.get(
            "service_id",
            ""
        ).strip()

        if (
            route_id in r15_routes
            and
            service_id in serveis_actius
        ):

            r15_trips.append(
                trip
            )

    print(
        "Trips R15 el",
        DATA,
        ":",
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

        trip_id = stop_time[
            "trip_id"
        ]

        if trip_id not in r15_trip_ids:
            continue

        stop_id = stop_time[
            "stop_id"
        ]

        parades[trip_id].append({

            "sequence": int(
                stop_time[
                    "stop_sequence"
                ]
            ),

            "station": stop_names.get(
                stop_id,
                stop_id
            ),

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
    # MOSTRAR CIRCULACIONS
    # -----------------------------------------

    print()
    print(
        "=========================================="
    )
    print(
        "CIRCULACIONS R15 DEL 1/10/2026"
    )
    print(
        "=========================================="
    )

    total_reus = 0

    for trip in r15_trips:

        trip_id = trip["trip_id"]

        stops_trip = parades.get(
            trip_id,
            []
        )

        if not stops_trip:
            continue

        # Buscar Reus

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

        total_reus += 1

        print()
        print("------------------------------------------")

        print(
            "TRIP:",
            trip_id
        )

        print(
            "ROUTE:",
            trip.get("route_id")
        )

        print(
            "SERVICE:",
            trip.get("service_id")
        )

        print(
            "ORIGEN:",
            stops_trip[0]["station"],
            stops_trip[0]["departure"]
        )

        print(
            "REUS:",
            stops_trip[reus_index]["arrival"],
            "→",
            stops_trip[reus_index]["departure"]
        )

        print(
            "DESTÍ:",
            stops_trip[-1]["station"],
            stops_trip[-1]["arrival"]
        )

        print(
            "PARADES:"
        )

        for parada in stops_trip:

            print(
                "   ",
                parada["station"],
                "|",
                parada["arrival"],
                "→",
                parada["departure"]
            )

    print()
    print(
        "=========================================="
    )

    print(
        "TOTAL TRIPS R15:",
        len(r15_trips)
    )

    print(
        "TOTAL TRIPS QUE PASSEN PER REUS:",
        total_reus
    )

    print(
        "=========================================="
    )


if __name__ == "__main__":

    main()
