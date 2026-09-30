
import requests
import zipfile
import io
import csv

# URL oficial del GTFS de Rodalies de Renfe
GTFS_URL = "https://data.renfe.com/api/3/action/package_show?id=horarios-cercanias"


def descarregar_gtfs():

    print("Obtenint informació del GTFS de Renfe...")

    resposta = requests.get(GTFS_URL)
    resposta.raise_for_status()

    dades = resposta.json()

    recursos = dades["result"]["resources"]

    gtfs = None

    for recurs in recursos:
        if recurs.get("format", "").upper() == "GTFS":
            gtfs = recurs["url"]
            break

    if not gtfs:
        raise Exception(
            "No s'ha trobat el recurs GTFS de Renfe"
        )

    print("GTFS trobat:")
    print(gtfs)

    resposta = requests.get(gtfs)
    resposta.raise_for_status()

    return zipfile.ZipFile(
        io.BytesIO(resposta.content)
    )


def llegir_fitxer(zip_gtfs, nom):

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
    print("Fitxers disponibles:")

    for nom in gtfs.namelist():
        print(" -", nom)

    print()
    print("Buscant línies que continguin R15...")

    routes = llegir_fitxer(
        gtfs,
        "routes.txt"
    )

    trobades = []

    for route in routes:

        text = " ".join(
            str(value)
            for value in route.values()
        ).upper()

        if "R15" in text:

            trobades.append(route)

    print()

    if not trobades:

        print(
            "No s'ha trobat cap línia amb R15."
        )

    else:

        print(
            f"S'han trobat {len(trobades)} resultats:"
        )

        for route in trobades:

            print()
            for key, value in route.items():

                print(
                    f"{key}: {value}"
                )


if __name__ == "__main__":
    main()
