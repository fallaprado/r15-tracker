import requests
import zipfile
import io
import csv

print("=== DIAGNÒSTIC R15 ===")

GTFS_API = "https://data.renfe.com/api/3/action/package_show?id=horarios-cercanias"


def descarregar_gtfs():

    resposta = requests.get(GTFS_API)
    resposta.raise_for_status()

    dades = resposta.json()

    for recurs in dades["result"]["resources"]:

        if recurs.get("format", "").upper() == "GTFS":

            print("GTFS oficial:")
            print(recurs["url"])

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

    routes = llegir(gtfs, "routes.txt")
    trips = llegir(gtfs, "trips.txt")

    print()
    print("=== ROUTES R15 ===")

    r15_routes = set()

    for route in routes:

        if route.get(
            "route_short_name",
            ""
        ).strip() == "R15":

            route_id = route["route_id"].strip()

            r15_routes.add(route_id)

            print(
                repr(route_id),
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
    print("=== ROUTE_ID DELS TRIPS QUE CONTENEN R15 ===")

    route_ids_trips = set()

    for trip in trips:

        route_id = trip.get(
            "route_id",
            ""
        ).strip()

        if "R15" in route_id:

            route_ids_trips.add(
                route_id
            )

    for route_id in sorted(
        route_ids_trips
    ):

        print(
            repr(route_id)
        )

    print()
    print(
        "Total route_id R15 utilitzats pels trips:",
        len(route_ids_trips)
    )

    print()
    print("=== INTERSECCIÓ ===")

    interseccio = (
        r15_routes
        &
        route_ids_trips
    )

    for route_id in sorted(
        interseccio
    ):

        print(
            "COINCIDEIX:",
            repr(route_id)
        )

    print()
    print(
        "Total coincidències:",
        len(interseccio)
    )

    print()
    print("=== PRIMERS TRIPS R15 ===")

    contador = 0

    for trip in trips:

        route_id = trip.get(
            "route_id",
            ""
        ).strip()

        if "R15" in route_id:

            print(
                "trip_id:",
                trip.get("trip_id"),
                "| route_id:",
                repr(route_id),
                "| service_id:",
                trip.get("service_id"),
                "| direction_id:",
                trip.get("direction_id")
            )

            contador += 1

            if contador >= 20:
                break

    print()
    print("Fi del diagnòstic.")


if __name__ == "__main__":
    main()
