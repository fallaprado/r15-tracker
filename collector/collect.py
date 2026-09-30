import requests
import zipfile
import io
import csv

print("=== DIAGNÒSTIC CALENDAR R15 ===")

GTFS_API = "https://data.renfe.com/api/3/action/package_show?id=horarios-cercanias"


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

    calendar = llegir(
        gtfs,
        "calendar.txt"
    )

    print()
    print("COLUMNES DEL CALENDAR:")
    print(
        list(calendar[0].keys())
    )

    print()
    print("PRIMERS 10 REGISTRES:")
    print("--------------------------------")

    for fila in calendar[:10]:

        print(fila)

    print("--------------------------------")

    print(
        "Total registres:",
        len(calendar)
    )


if __name__ == "__main__":
    main()
