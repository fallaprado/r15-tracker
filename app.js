"use strict";

let currentData = null;

const directionSelect =
    document.getElementById("direction");

const dateInput =
    document.getElementById("date");

const summary =
    document.getElementById("summary");

const trainsContainer =
    document.getElementById("trains");


/* =====================================================
   DATA ACTUAL
   ===================================================== */

function getTodayLocal() {

    const now = new Date();

    const year =
        now.getFullYear();

    const month =
        String(
            now.getMonth() + 1
        ).padStart(2, "0");

    const day =
        String(
            now.getDate()
        ).padStart(2, "0");

    return (
        year +
        "-" +
        month +
        "-" +
        day
    );
}


/* =====================================================
   MINUTS → HORA
   ===================================================== */

function minutesToTime(minutes) {

    if (
        minutes === null ||
        minutes === undefined
    ) {
        return "--:--";
    }

    const value =
        Number(minutes);

    if (Number.isNaN(value)) {
        return "--:--";
    }

    let total =
        value % 1440;

    if (total < 0) {
        total += 1440;
    }

    const hours =
        Math.floor(
            total / 60
        );

    const mins =
        total % 60;

    return (
        String(hours).padStart(2, "0") +
        ":" +
        String(mins).padStart(2, "0")
    );
}


/* =====================================================
   DATA → DD/MM/YYYY
   ===================================================== */

function formatDate(dateString) {

    if (!dateString) {
        return "";
    }

    const parts =
        dateString.split("-");

    if (parts.length !== 3) {
        return dateString;
    }

    return (
        parts[2] +
        "/" +
        parts[1] +
        "/" +
        parts[0]
    );
}


/* =====================================================
   RETARD ACTUAL DEL TREN
   ===================================================== */

/*
 * Busca el retard més recent que tenim
 * en qualsevol de les parades del tren.
 *
 * Això és el que utilitzarem mentre
 * el tren encara està circulant.
 */

function getCurrentTrainDelay(train) {

    const stops =
        train.stops || [];

    let latestDelay = null;

    let latestIndex = -1;


    stops.forEach(
        function(stop, index) {

            if (
                stop.delay_minutes !==
                undefined &&
                stop.delay_minutes !== null
            ) {

                const delay =
                    Number(
                        stop.delay_minutes
                    );

                if (
                    !Number.isNaN(delay) &&
                    index > latestIndex
                ) {

                    latestDelay =
                        delay;

                    latestIndex =
                        index;
                }
            }
        }
    );


    /*
     * Si no tenim retard en cap parada,
     * utilitzem el retard general del tren
     * que envia Renfe.
     */

    if (latestDelay === null) {

        if (
            train.realtime_trip_delay_minutes !==
            undefined &&
            train.realtime_trip_delay_minutes !==
            null
        ) {

            const tripDelay =
                Number(
                    train.realtime_trip_delay_minutes
                );

            if (
                !Number.isNaN(tripDelay)
            ) {

                latestDelay =
                    tripDelay;
            }
        }
    }


    /*
     * Si tampoc tenim això,
     * considerem que va en hora.
     */

    if (latestDelay === null) {
        latestDelay = 0;
    }


    return latestDelay;
}


/* =====================================================
   ESTAT DEL TREN
   ===================================================== */

function getTrainStatus(train) {

    if (
        !train.departure ||
        !train.arrival
    ) {
        return "pending";
    }


    const now =
        new Date();

    const departure =
        new Date(
            train.departure
        );

    const arrival =
        new Date(
            train.arrival
        );


    if (
        Number.isNaN(
            departure.getTime()
        )
    ) {
        return "pending";
    }


    if (
        Number.isNaN(
            arrival.getTime()
        )
    ) {
        return "pending";
    }


    /*
     * RETARD ACTUAL
     */

    const currentDelay =
        getCurrentTrainDelay(
            train
        );


    /*
     * RETARD FINAL
     */

    const finalDelay =
        Number(
            train.final_delay_minutes || 0
        );


    /* =================================================
       MÉS DE 15 MINUTS
       =================================================

       Té prioritat absoluta.

       Si el tren porta >15 minuts
       de retard, és vermell.

       També si ja ha arribat
       amb >15 minuts.
    */

    if (
        currentDelay > 15 ||
        finalDelay > 15
    ) {

        return "late";
    }


    /* =================================================
       ENCARA NO HA SORTIT
       ================================================= */

    if (
        now < departure
    ) {

        return "pending";
    }


    /* =================================================
       JA HA ARRIBAT
       =================================================

       Si ha arribat amb ≤15 minuts,
       és gris.
    */

    if (
        now >= arrival
    ) {

        return "finished";
    }


    /* =================================================
       ESTÀ CIRCULANT
       ================================================= */


    /*
     * 4-15 minuts
     * → TARONJA
     */

    if (
        currentDelay >= 4
    ) {

        return "warning";
    }


    /*
     * 0-3 minuts
     * → VERD
     */

    return "running";
}


/* =====================================================
   TEXT DE L'ESTAT
   ===================================================== */

function getStatusText(status) {

    if (
        status === "pending"
    ) {

        return "Pendent";
    }


    if (
        status === "finished"
    ) {

        return "Finalitzat";
    }


    if (
        status === "late"
    ) {

        return "Retard >15 min";
    }


    if (
        status === "warning"
    ) {

        return "Retard";
    }


    return "En circulació";
}


/* =====================================================
   CARREGAR DADES
   ===================================================== */

async function loadData() {

    const selectedDate =
        dateInput.value;


    if (!selectedDate) {
        return;
    }


    trainsContainer.innerHTML =
        '<p class="loading">' +
        "Carregant dades..." +
        "</p>";


    try {

        const url =
            "data/" +
            selectedDate +
            ".json?t=" +
            Date.now();


        const response =
            await fetch(url);


        if (!response.ok) {

            throw new Error(
                "No existeix el fitxer " +
                selectedDate +
                ".json"
            );
        }


        const data =
            await response.json();


        currentData =
            data;


        render();


    } catch (error) {

        console.error(
            "Error carregant dades:",
            error
        );


        currentData =
            null;


        summary.innerHTML =
            "";


        trainsContainer.innerHTML =
            '<div class="empty">' +
            "<strong>" +
            "No hi ha dades disponibles." +
            "</strong>" +
            "<br><br>" +
            "No s'ha trobat el fitxer del dia " +
            formatDate(
                selectedDate
            ) +
            "." +
            "</div>";
    }
}


/* =====================================================
   RENDERITZAR
   ===================================================== */

function render() {

    if (!currentData) {
        return;
    }


    const selectedDirection =
        directionSelect.value;


    const allTrains =
        currentData.trains || [];


    const trains =
        allTrains.filter(
            function(train) {

                return (
                    train.direction ===
                    selectedDirection
                );
            }
        );


    summary.innerHTML =
        "<strong>" +
        formatDate(
            currentData.date
        ) +
        "</strong>" +
        " · " +
        trains.length +
        " circulacions";


    trainsContainer.innerHTML =
        "";


    if (
        trains.length === 0
    ) {

        trainsContainer.innerHTML =
            '<div class="empty">' +
            "No hi ha circulacions " +
            "per a aquest sentit." +
            "</div>";

        return;
    }


    trains.forEach(
        function(train) {

            const element =
                createTrain(
                    train
                );

            trainsContainer.appendChild(
                element
            );
        }
    );
}


/* =====================================================
   CREAR TREN
   ===================================================== */

function createTrain(train) {

    const article =
        document.createElement(
            "article"
        );


    const status =
        getTrainStatus(
            train
        );


    article.className =
        "train " +
        status;


    const stops =
        train.stops || [];


    let firstStop =
        null;

    let lastStop =
        null;


    if (
        stops.length > 0
    ) {

        firstStop =
            stops[0];

        lastStop =
            stops[
                stops.length - 1
            ];
    }


    let departureTime =
        "--:--";

    let arrivalTime =
        "--:--";


    if (firstStop) {

        departureTime =
            minutesToTime(
                firstStop.scheduled_departure ??
                firstStop.scheduled_arrival
            );
    }


    if (lastStop) {

        arrivalTime =
            minutesToTime(
                lastStop.scheduled_arrival ??
                lastStop.scheduled_departure
            );
    }


    const finalDelay =
        Number(
            train.final_delay_minutes || 0
        );


    const currentDelay =
        getCurrentTrainDelay(
            train
        );


    /* =================================================
       CAPÇALERA
       ================================================= */

    const header =
        document.createElement(
            "div"
        );

    header.className =
        "train-header";


    /* -------------------------------------------------
       NÚMERO
       ------------------------------------------------- */

    const number =
        document.createElement(
            "div"
        );

    number.className =
        "train-number";


    const numberStrong =
        document.createElement(
            "strong"
        );

    numberStrong.textContent =
        "R15";


    const trainId =
        document.createElement(
            "span"
        );

    trainId.textContent =
        train.train_id || "";


    number.appendChild(
        numberStrong
    );

    number.appendChild(
        trainId
    );


    /* -------------------------------------------------
       RUTA
       ------------------------------------------------- */

    const route =
        document.createElement(
            "div"
        );

    route.className =
        "train-route";


    const departure =
        document.createElement(
            "span"
        );

    departure.textContent =
        departureTime;


    const arrow =
        document.createElement(
            "span"
        );

    arrow.className =
        "arrow";

    arrow.textContent =
        "→";


    const arrival =
        document.createElement(
            "span"
        );

    arrival.textContent =
        arrivalTime;


    route.appendChild(
        departure
    );

    route.appendChild(
        arrow
    );

    route.appendChild(
        arrival
    );


    /* -------------------------------------------------
       ESTAT
       ------------------------------------------------- */

    const statusElement =
        document.createElement(
            "div"
        );

    statusElement.className =
        "train-status";


    /*
     * PUNT ANIMAT
     *
     * Només mentre circula.
     */

    if (
        status === "running" ||
        status === "warning" ||
        status === "late"
    ) {

        const dot =
            document.createElement(
                "span"
            );

        dot.className =
            "live-dot";


        statusElement.appendChild(
            dot
        );
    }


    const statusText =
        document.createElement(
            "span"
        );

    statusText.textContent =
        getStatusText(
            status
        );


    statusElement.appendChild(
        statusText
    );


    /*
     * Mostrar retard
     */

    let delayToShow =
        currentDelay;


    /*
     * Si ja ha arribat,
     * mostrem el retard final.
     */

    if (
        status === "finished" ||
        status === "late"
    ) {

        delayToShow =
            finalDelay;
    }


    if (
        delayToShow > 0
    ) {

        const delay =
            document.createElement(
                "div"
            );

        delay.className =
            "delay";


        delay.textContent =
            "+" +
            delayToShow +
            " min";


        statusElement.appendChild(
            delay
        );
    }


    header.appendChild(
        number
    );

    header.appendChild(
        route
    );

    header.appendChild(
        statusElement
    );


    article.appendChild(
        header
    );


    /* =================================================
       PARADES
       ================================================= */

    const stopsContainer =
        document.createElement(
            "div"
        );

    stopsContainer.className =
        "stops";


    stops.forEach(
        function(stop) {

            const row =
                document.createElement(
                    "div"
                );

            row.className =
                "stop";


            const station =
                document.createElement(
                    "div"
                );

            station.className =
                "stop-station";

            station.textContent =
                stop.station || "";


            const times =
                document.createElement(
                    "div"
                );

            times.className =
                "stop-times";


            const scheduled =
                document.createElement(
                    "span"
                );

            scheduled.className =
                "scheduled";


            scheduled.textContent =
                minutesToTime(
                    stop.scheduled_arrival ??
                    stop.scheduled_departure
                );


            const actual =
                document.createElement(
                    "span"
                );

            actual.className =
                "actual";


            if (
                stop.actual_minutes !== null &&
                stop.actual_minutes !== undefined
            ) {

                actual.textContent =
                    minutesToTime(
                        stop.actual_minutes
                    );

            } else {

                actual.textContent =
                    "--:--";

                actual.classList.add(
                    "pending-time"
                );
            }


            const stopDelay =
                Number(
                    stop.delay_minutes || 0
                );


            let delayElement =
                null;


            if (
                stopDelay !== 0
            ) {

                delayElement =
                    document.createElement(
                        "span"
                    );

                delayElement.className =
                    "delay";


                if (
                    stopDelay > 0
                ) {

                    delayElement.textContent =
                        "+" +
                        stopDelay +
                        " min";

                } else {

                    delayElement.textContent =
                        stopDelay +
                        " min";
                }
            }


            times.appendChild(
                scheduled
            );

            times.appendChild(
                actual
            );


            if (
                delayElement
            ) {

                times.appendChild(
                    delayElement
                );
            }


            row.appendChild(
                station
            );

            row.appendChild(
                times
            );


            stopsContainer.appendChild(
                row
            );
        }
    );


    /* =================================================
       DEVOLUCIÓ EXPRESS
       ================================================= */

    if (
        finalDelay > 15
    ) {

        const refund =
            document.createElement(
                "div"
            );


        refund.className =
            "refund-message";


        refund.textContent =
            "Sí es pot sol·licitar devolució express";


        stopsContainer.appendChild(
            refund
        );
    }


    article.appendChild(
        stopsContainer
    );


    /* =================================================
       OBRIR / TANCAR
       ================================================= */

    header.onclick =
        function() {

            const isOpen =
                article.classList.contains(
                    "expanded"
                );


            if (isOpen) {

                article.classList.remove(
                    "expanded"
                );

            } else {

                article.classList.add(
                    "expanded"
                );
            }
        };


    return article;
}


/* =====================================================
   EVENTS
   ===================================================== */

directionSelect.onchange =
    function() {

        render();
    };


dateInput.onchange =
    function() {

        loadData();
    };


/* =====================================================
   INICI
   ===================================================== */

dateInput.value =
    getTodayLocal();


loadData();


/*
 * Actualitzar cada minut.
 */

setInterval(
    function() {

        loadData();

    },
    60000
);
