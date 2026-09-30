import requests
import zipfile
import io
import csv
from collections import defaultdict
from datetime import date

print("=== DIAGNÒSTIC PARADES R15 - 1 OCTUBRE 2026 ===")

GTFS_API = "https://data.renfe.com/api/3/action/package_show?id=horarios-cercanias"

DATA = date(2026, 10, 1)


def descarregar_gtfs():

    resposta = requests.get(GTFS_API)
    resposta.raise_for_status()

    dades = resposta.json()

    for recurs in dades["result"]["resources"]:

        if recurs.get("format", "").upper() == "GTFS":

            resposta = requests.get(recurs["url"])
            resposta.raise_for_status()

            return zipfile.ZipFile(
                io.BytesIO(resposta.content)
            )

    raise Exception("No s'ha trobat el GTFS")


def llegir(zip_gtfs, nom):

    with zip_gtfs.open(nom) as f:

        lector = csv.DictReader(
            io.TextIOWrapper(
                f,
                encoding="utf-8-sig"
            )
        )

        lector.fieldnames = [
            camp.strip()
            for camp in lector.fieldnames
        ]

        return list(lector)


def servei_actiu(service, data):

    inici = date.fromisoformat(
        service["start_date"].strip()
    )

    final = date.fromisoformat(
        service["end_date"].strip()
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

    return service.get(
        dia,
        ""
    ).strip() == "1"


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

    # =========================================
    # ESTACIONS
    # =========================================

    stop_names = {}

    for stop in stops:

        stop_names[
            stop["stop_id"]
        ] = stop.get(
            "stop_name",
            ""
        ).strip()

    # =========================================
    # RUTES R15
    # =========================================

    r15_routes = set()

    for route in routes:

        if route.get(
            "route_short_name",
            ""
        ).strip() == "R15":

            r15_routes.add(
                route["route_id"].strip()
            )

    # =========================================
    # SERVEIS ACTIUS
    # =========================================

    serveis_actius = set()

    for service in calendar:

        if servei_actiu(
            service,
            DATA
        ):

            serveis_actius.add(
                service["service_id"].strip()
            )

    # =========================================
    # TRIPS R15 DEL DIA
    # =========================================

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

            r15_trips.append(trip)

    # =========================================
    # STOP TIMES
    # =========================================

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

        parades[trip_id].append({

            "sequence": int(
                stop_time["stop_sequence"]
            ),

            "station": stop_names.get(
                stop_id,
                stop_id
            ),

            "arrival": stop_time.get(
                "arrival_time",
                ""
            ).strip(),

            "departure": stop_time.get(
                "departure_time",
                ""
            ).strip()
        })

    # =========================================
    # ORDENAR
    # =========================================

    for trip_id in parades:

        parades[trip_id].sort(
            key=lambda x: x["sequence"]
        )

    # =========================================
    # MOSTRAR TOTS ELS TRIPS
    # =========================================

    print()
    print("==========================================")
    print("40 TRIPS R15 DEL 1/10/2026")
    print("==========================================")

    for trip in r15_trips:

        trip_id = trip["trip_id"]

        stops_trip = parades.get(
            trip_id,
            []
        )

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
            "NOMBRE DE PARADES:",
            len(stops_trip)
        )

        if not stops_trip:
            print(
                "⚠️ Aquest trip no té stop_times"
            )
            continue

        print(
            "PRIMERA:",
            stops_trip[0]["station"],
            "|",
            stops_trip[0]["departure"]
        )

        print(
            "ÚLTIMA:",
            stops_trip[-1]["station"],
            "|",
            stops_trip[-1]["arrival"]
        )

        print()
        print("TOTES LES PARADES:")

        for parada in stops_trip:

            print(
                "   ",
                parada["sequence"],
                "|",
                repr(parada["station"]),
                "|",
                parada["arrival"],
                "→",
                parada["departure"]
            )

    # =========================================
    # BUSCAR QUALSEVOL ESTACIÓ QUE CONTINGA
    # "REUS"
    # =========================================

    print()
    print("==========================================")
    print("ESTACIONS QUE CONTENEN 'REUS'")
    print("==========================================")

    trobades = set()

    for stop_id, nom in stop_names.items():

        if "REUS" in nom.upper():

            trobades.add(
                (
                    stop_id,
                    nom
                )
            )

    for stop_id, nom in sorted(trobades):

        print(
            repr(stop_id),
            "->",
            repr(nom)
        )

    print()
    print(
        "Total estacions amb REUS:",
        len(trobades)
    )

    print()
    print("==========================================")
    print("FI DEL DIAGNÒSTIC")
    print("==========================================")


if __name__ == "__main__":
    main()
