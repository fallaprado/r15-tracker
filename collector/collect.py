import requests
import zipfile
import io
import csv

print("=== VERSIÓ NOVA DEL COLLECTOR ===")

GTFS_API = "https://data.renfe.com/api/3/action/package_show?id=horarios-cercanias"


def descarregar_gtfs():

    print("Obtenint informació del GTFS de Renfe...")

    resposta = requests.get(GTFS_API)
    resposta.raise_for_status()

    dades = resposta.json()

    recursos = dades["result"]["resources"]

    gtfs_url = None

    for recurs in recursos:

        if recurs.get("format", "").upper() == "GTFS":

            gtfs_url = recurs["url"]
            break

    if not gtfs_url:

        raise Exception(
            "No s'ha trobat el GTFS oficial"
        )

    print("GTFS trobat:")
    print(gtfs_url)

    resposta = requests.get(gtfs_url)
    resposta.raise_for_status()

    return zipfile.ZipFile(
        io.BytesIO(resposta.content)
    )


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

    print()
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

    print()
    print("Routes R15:")

    r15_routes = {}

    for route in routes:

        if route.get(
            "route_short_name",
            ""
        ).strip() == "R15":

            route_id = route["route_id"]

            r15_routes[route_id] = route

            print(
                route_id,
                "->",
                route.get(
                    "route_long_name",
                    ""
                ).strip()
            )

    print()
    print(
        "Total routes R15:",
        len(r15_routes)
    )

    print()
    print(
        "EXEMPLE DE TRIPS DEL GTFS:"
    )

    print(
        "---------------------------"
    )

    for trip in trips[:20]:

        print(
            "trip_id:",
            trip.get("trip_id"),
            "| route_id:",
            trip.get("route_id"),
            "| service_id:",
            trip.get("service_id"),
            "| headsign:",
            trip.get("trip_headsign")
        )

    print(
        "---------------------------"
    )

    print(
        "Total trips al GTFS:",
        len(trips)
    )

    print()
    print(
        "route_id diferents utilitzats pels trips:"
    )

    route_ids_trips = set()

    for trip in trips:

        route_ids_trips.add(
            trip.get("route_id")
        )

    for route_id in sorted(
        route_ids_trips
    ):

        if "R15" in route_id:

            print(
                "TROBAT:",
                route_id
            )

    print()
    print(
        "Fi de la prova."
    )


if __name__ == "__main__":

    main()
