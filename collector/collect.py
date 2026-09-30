import requests
import zipfile
import io
import csv
from collections import defaultdict
print("=== VERSIÓ NOVA DEL COLLECTOR ===")

GTFS_API = "https://data.renfe.com/api/3/action/package_show?id=horarios-cercanias"

# Estacions que ens interessen per identificar els dos sentits
ESTACIONS_CLAU = [
    "REUS",
    "BARCELONA",
    "BARCELONA-SANTS",
    "SANTS",
    "PASSEIG DE GRACIA",
    "ESTACIO DE FRANCA",
]


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

    routes = llegir(gtfs, "routes.txt")
    trips = llegir(gtfs, "trips.txt")
    stop_times = llegir(gtfs, "stop_times.txt")
    stops = llegir(gtfs, "stops.txt")

    # -------------------------------------------------
    # 1. Identificar les routes R15
    # -------------------------------------------------

    r15_routes = {}

    for route in routes:

        if route.get("route_short_name", "").strip() == "R15":

            r15_routes[
                route["route_id"]
            ] = route

    print()
    print(
        f"Routes R15 trobades: {len(r15_routes)}"
    )

    for route_id, route in r15_routes.items():

        print(
            route_id,
            "->",
            route.get("route_long_name", "").strip()
        )

    # -------------------------------------------------
    # 2. Identificar trips que pertanyen a R15
    # -------------------------------------------------

   r15_trips = []

for trip in trips:

    route_id = trip.get("route_id", "")

    if route_id in r15_routes:

        r15_trips.append(trip)


print()
print("EXEMPLE DE TRIPS DEL GTFS:")
print("---------------------------")

for trip in trips[:10]:

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

print("---------------------------")

print(
    "Total trips al GTFS:",
    len(trips)
)

print(
    "Trips R15:",
    len(r15_trips)
)

    print()
    print(
        f"Trips R15 trobats: {len(r15_trips)}"
    )

    # -------------------------------------------------
    # 3. Índex d'estacions
    # -------------------------------------------------

    stop_names = {}

    for stop in stops:

        stop_names[
            stop["stop_id"]
        ] = stop.get(
            "stop_name",
            ""
        ).strip()

    # -------------------------------------------------
    # 4. Relacionar cada trip amb les seves estacions
    # -------------------------------------------------

    stops_per_trip = defaultdict(list)

    r15_trip_ids = {
        trip["trip_id"]
        for trip in r15_trips
    }

    for stop_time in stop_times:

        trip_id = stop_time["trip_id"]

        if trip_id not in r15_trip_ids:
            continue

        stop_id = stop_time["stop_id"]

        station = stop_names.get(
            stop_id,
            stop_id
        )

        stops_per_trip[trip_id].append(
            {
                "stop_sequence":
                    int(
                        stop_time[
                            "stop_sequence"
                        ]
                    ),

                "station":
                    station,

                "arrival":
                    stop_time.get(
                        "arrival_time",
                        ""
                    ),

                "departure":
                    stop_time.get(
                        "departure_time",
                        ""
                    ),
            }
        )

    # -------------------------------------------------
    # 5. Ordenar parades
    # -------------------------------------------------

    for trip_id in stops_per_trip:

        stops_per_trip[
            trip_id
        ].sort(
            key=lambda x:
                x["stop_sequence"]
        )

    # -------------------------------------------------
    # 6. Mostrar trips que passen per REUS
    # -------------------------------------------------

    print()
    print(
        "=============================="
    )
    print(
        "CIRCULACIONS R15 QUE PASSEN PER REUS"
    )
    print(
        "=============================="
    )

    comptador = 0

    for trip in r15_trips:

        trip_id = trip["trip_id"]

        parades = stops_per_trip.get(
            trip_id,
            []
        )

        noms = [
            p["station"].upper()
            for p in parades
        ]

        te_reus = any(
            "REUS" in nom
            for nom in noms
        )

        if not te_reus:
            continue

        comptador += 1

        print()
        print(
            f"TRIP: {trip_id}"
        )

        print(
            f"Route: {trip['route_id']}"
        )

        print(
            f"Service: {trip.get('service_id')}"
        )

        print(
            f"Capçalera: "
            f"{trip.get('trip_headsign', '')}"
        )

        for parada in parades:

            print(
                f"  {parada['station']}"
                f" | "
                f"{parada['arrival']}"
                f" → "
                f"{parada['departure']}"
            )

    print()
    print(
        "=============================="
    )

    print(
        f"Total trips R15 que passen per Reus: "
        f"{comptador}"
    )


if __name__ == "__main__":
    main()
