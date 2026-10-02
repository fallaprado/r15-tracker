const directionSelect = document.getElementById("direction");
const dateInput = document.getElementById("date");
const trainsContainer = document.getElementById("trains");
const summaryContainer = document.getElementById("summary");
const toggleHistoryButton = document.getElementById("toggleHistory");


// ============================================================
// ESTAT DE LA PÀGINA
// ============================================================

// Per defecte NO mostrem els trens que ja han arribat.
let showHistory = false;


// ============================================================
// DATA ACTUAL LOCAL
// ============================================================

function getTodayLocal() {

    const now = new Date();

    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
}


// ============================================================
// CONVERTIR HH:MM A MINUTS
// ============================================================

function timeToMinutes(timeString) {

    if (!timeString) {
        return null;
    }

    const match = timeString.match(/(\d{1,2}):(\d{2})/);

    if (!match) {
        return null;
    }

    return (
        parseInt(match[1], 10) * 60 +
        parseInt(match[2], 10)
    );
}


// ============================================================
// CONVERTIR MINUTS A HH:MM
// ============================================================

function minutesToTime(minutes) {

    if (
        minutes === null ||
        minutes === undefined ||
        isNaN(minutes)
    ) {
        return "--:--";
    }

    // Els horaris GTFS poden superar les 24:00
    // en serveis nocturns.
    let totalMinutes = Math.round(minutes);

    totalMinutes = totalMinutes % (24 * 60);

    if (totalMinutes < 0) {
        totalMinutes += 24 * 60;
    }

    const hours = Math.floor(totalMinutes / 60);
    const mins = totalMinutes % 60;

    return `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}`;
}


// ============================================================
// FORMAT DE DATA
// ============================================================

function formatDate(dateString) {

    const parts = dateString.split("-");

    if (parts.length !== 3) {
        return dateString;
    }

    return `${parts[2]}/${parts[1]}/${parts[0]}`;
}


// ============================================================
// HORA DE SORTIDA DEL TREN
// ============================================================

function getDepartureMinutes(train) {

    return timeToMinutes(
        train.departure
            ? train.departure.substring(11, 16)
            : null
    );
}


// ============================================================
// HORA D'ARRIBADA DEL TREN
// ============================================================

function getArrivalMinutes(train) {

    return timeToMinutes(
        train.arrival
            ? train.arrival.substring(11, 16)
            : null
    );
}


// ============================================================
// RETARD ACTUAL DEL TREN
// ============================================================

function getCurrentTrainDelay(train) {

    let latestDelay = null;

    if (train.stops) {

        train.stops.forEach(stop => {

            if (
                stop.delay_minutes !== null &&
                stop.delay_minutes !== undefined
            ) {

                latestDelay = stop.delay_minutes;
            }

        });
    }


    // Si tenim informació directa d'una parada,
    // aquesta té prioritat.
    if (latestDelay !== null) {
        return latestDelay;
    }


    // Retard global del tren.
    if (
        train.realtime_trip_delay_minutes !== null &&
        train.realtime_trip_delay_minutes !== undefined
    ) {

        return train.realtime_trip_delay_minutes;
    }


    // Retard final conegut.
    if (
        train.final_delay_minutes !== null &&
        train.final_delay_minutes !== undefined
    ) {

        return train.final_delay_minutes;
    }


    return 0;
}


// ============================================================
// RETARD FINAL
// ============================================================

function getFinalDelay(train) {

    if (
        train.final_delay_minutes !== null &&
        train.final_delay_minutes !== undefined
    ) {

        return train.final_delay_minutes;
    }

    return null;
}


// ============================================================
// ESTAT DEL TREN
// ============================================================
//
// pending  → encara no ha sortit
// running  → està circulant i va bé
// warning  → circulant amb 4-15 minuts
// late     → retard superior a 15 minuts
// finished  → ja ha arribat
//
// PRIORITAT:
//
// 1. Retard >15 → vermell
// 2. Ja ha arribat → gris
// 3. Encara no ha sortit → gris
// 4. Circulant amb 4-15 → taronja
// 5. Circulant amb 0-3 → verd
//
// ============================================================

function getTrainStatus(train) {

    const currentDelay = getCurrentTrainDelay(train);
    const finalDelay = getFinalDelay(train);


    // --------------------------------------------------------
    // 1. RETARD SUPERIOR A 15 MINUTS
    // --------------------------------------------------------

    if (
        currentDelay > 15 ||
        (
            finalDelay !== null &&
            finalDelay > 15
        )
    ) {

        return "late";
    }


    // --------------------------------------------------------
    // 2. TREN JA ARRIBAT
    // --------------------------------------------------------

    // Aquest és el camp que realment utilitza
    // el JSON generat pel collector.

    if (train.arrived === true) {

        return "finished";
    }


    // --------------------------------------------------------
    // 3. TREN ENCARA NO HA SORTIT
    // --------------------------------------------------------

    if (train.started === false) {

        return "pending";
    }


    // --------------------------------------------------------
    // 4. TREN CIRCULANT
    // --------------------------------------------------------

    if (currentDelay >= 4) {

        return "warning";
    }


    return "running";
}


// ============================================================
// TEXT DE L'ESTAT
// ============================================================

function getStatusText(status) {

    switch (status) {

        case "pending":
            return "Pendent de sortida";

        case "running":
            return "En circulació";

        case "warning":
            return "En circulació · retard";

        case "late":
            return "Retard superior a 15 min";

        case "finished":
            return "Arribat";

        default:
            return "";
    }
}


// ============================================================
// OBTENIR NOM DE L'ORIGEN
// ============================================================

function getTrainOrigin(train) {

    if (train.stops && train.stops.length > 0) {

        return train.stops[0].station || "";
    }

    return "";
}


// ============================================================
// OBTENIR NOM DEL DESTÍ
// ============================================================

function getTrainDestination(train) {

    if (train.stops && train.stops.length > 0) {

        return train.stops[
            train.stops.length - 1
        ].station || "";
    }

    return "";
}


// ============================================================
// CARREGAR DADES
// ============================================================

async function loadData() {

    const date = dateInput.value;

    if (!date) {
        return;
    }


    trainsContainer.innerHTML =
        '<p class="loading">Carregant dades...</p>';


    try {

        const response = await fetch(
            `data/${date}.json?t=${Date.now()}`
        );


        if (!response.ok) {

            throw new Error(
                `No s'ha pogut carregar data/${date}.json`
            );
        }


        const data = await response.json();

        render(data);


    } catch (error) {

        console.error(error);


        trainsContainer.innerHTML = `
            <p class="error">
                No hi ha dades disponibles per al ${formatDate(date)}.
            </p>
        `;


        summaryContainer.innerHTML = "";
    }
}


// ============================================================
// RENDERITZAR
// ============================================================

function render(data) {

    const direction = directionSelect.value;


    let trains = data.trains || [];


    // --------------------------------------------------------
    // FILTRAR SENTIT
    // --------------------------------------------------------

    trains = trains.filter(train => {

        return train.direction === direction;
    });


    // --------------------------------------------------------
    // ORDENAR PER HORA DE SORTIDA
    // --------------------------------------------------------

    trains.sort((a, b) => {

        return (
            getDepartureMinutes(a) -
            getDepartureMinutes(b)
        );
    });


    // --------------------------------------------------------
    // FILTRAR TRENS JA ARRIBATS
    // --------------------------------------------------------
    //
    // VISTA NORMAL:
    //   només pendents + circulant
    //
    // HISTÒRIC:
    //   tots els trens
    //
    // --------------------------------------------------------

    if (!showHistory) {

        trains = trains.filter(train => {

            const status = getTrainStatus(train);

            return status !== "finished";
        });
    }


    // ========================================================
    // RESUM
    // ========================================================

    const totalTrains =
        data.trains
            ? data.trains.filter(
                train =>
                    train.direction === direction
            ).length
            : 0;


    const visibleTrains = trains.length;


    if (showHistory) {

        summaryContainer.innerHTML = `
            <div class="summary">
                <strong>${visibleTrains}</strong>
                trens mostrats ·
                <strong>${totalTrains}</strong>
                circulacions del dia
            </div>
        `;

    } else {

        summaryContainer.innerHTML = `
            <div class="summary">
                <strong>${visibleTrains}</strong>
                trens pendents o en circulació
                ·
                ${totalTrains} circulacions previstes
            </div>
        `;
    }


    // ========================================================
    // NO HI HA TRENS
    // ========================================================

    if (trains.length === 0) {

        if (showHistory) {

            trainsContainer.innerHTML = `
                <div class="empty">

                    <p>
                        No hi ha trens registrats
                        per a aquest sentit.
                    </p>

                </div>
            `;

        } else {

            trainsContainer.innerHTML = `
                <div class="empty">

                    <p>
                        No hi ha cap tren pendent
                        o en circulació.
                    </p>

                    <button
                        class="history-button"
                        id="emptyHistoryButton"
                    >
                        Consultar trens ja arribats
                    </button>

                </div>
            `;


            // Important:
            // no fem servir onclick="..."
            // perquè aquest botó també ha de funcionar
            // de manera fiable.

            const emptyHistoryButton =
                document.getElementById(
                    "emptyHistoryButton"
                );


            if (emptyHistoryButton) {

                emptyHistoryButton.addEventListener(
                    "click",
                    enableHistory
                );
            }
        }

        return;
    }


    // ========================================================
    // CREAR TARGETES
    // ========================================================

    trainsContainer.innerHTML = "";


    trains.forEach(train => {

        const element =
            createTrain(train);

        trainsContainer.appendChild(element);
    });
}


// ============================================================
// CREAR TREN
// ============================================================

function createTrain(train) {

    const status =
        getTrainStatus(train);


    const currentDelay =
        getCurrentTrainDelay(train);


    const finalDelay =
        getFinalDelay(train);


    const article =
        document.createElement("article");


    article.className =
        `train ${status}`;


    // ========================================================
    // CAPÇALERA
    // ========================================================

    const header =
        document.createElement("div");


    header.className =
        "train-header";


    // ========================================================
    // INFORMACIÓ PRINCIPAL
    // ========================================================

    const mainInfo =
        document.createElement("div");


    mainInfo.className =
        "train-main";


    // --------------------------------------------------------
    // NÚMERO DE TREN
    // --------------------------------------------------------

    const trainNumber =
        document.createElement("div");


    trainNumber.className =
        "train-number";


    trainNumber.textContent =
        train.train_id ||
        train.trip_id ||
        "R15";


    // --------------------------------------------------------
    // RECORREGUT
    // --------------------------------------------------------

    const route =
        document.createElement("div");


    route.className =
        "train-route";


    route.textContent =
        `${getTrainOrigin(train)} → ${getTrainDestination(train)}`;


    mainInfo.appendChild(trainNumber);
    mainInfo.appendChild(route);


    // ========================================================
    // HORARIS
    // ========================================================

    const times =
        document.createElement("div");


    times.className =
        "train-times";


    // --------------------------------------------------------
    // SORTIDA
    // --------------------------------------------------------

    const departure =
        document.createElement("div");


    departure.innerHTML = `
        <span class="time-label">Sortida</span>
        <strong>
            ${minutesToTime(
                getDepartureMinutes(train)
            )}
        </strong>
    `;


    // --------------------------------------------------------
    // ARRIBADA
    // --------------------------------------------------------

    const arrival =
        document.createElement("div");


    arrival.innerHTML = `
        <span class="time-label">Arribada</span>
        <strong>
            ${minutesToTime(
                getArrivalMinutes(train)
            )}
        </strong>
    `;


    times.appendChild(departure);
    times.appendChild(arrival);


    // ========================================================
    // ESTAT
    // ========================================================

    const statusElement =
        document.createElement("div");


    statusElement.className =
        "train-status";


    // --------------------------------------------------------
    // PUNT ANIMAT
    // --------------------------------------------------------

    if (
        status === "running" ||
        status === "warning" ||
        status === "late"
    ) {

        const liveDot =
            document.createElement("span");


        liveDot.className =
            "live-dot";


        statusElement.appendChild(liveDot);
    }


    // --------------------------------------------------------
    // TEXT
    // --------------------------------------------------------

    const statusText =
        document.createElement("span");


    statusText.textContent =
        getStatusText(status);


    statusElement.appendChild(statusText);


    // ========================================================
    // RETARD
    // ========================================================

    if (
        status === "running" ||
        status === "warning"
    ) {

        if (currentDelay > 0) {

            const delay =
                document.createElement("span");


            delay.className =
                "delay";


            delay.textContent =
                `+${currentDelay} min`;


            statusElement.appendChild(delay);
        }

    } else if (
        status === "late" &&
        finalDelay !== null
    ) {

        const delay =
            document.createElement("span");


        delay.className =
            "delay";


        delay.textContent =
            `+${finalDelay} min`;


        statusElement.appendChild(delay);
    }


    // ========================================================
    // MUNTAR CAPÇALERA
    // ========================================================

    header.appendChild(mainInfo);
    header.appendChild(times);
    header.appendChild(statusElement);


    // ========================================================
    // FLETXA
    // ========================================================

    const arrow =
        document.createElement("span");


    arrow.className =
        "train-arrow";


    arrow.textContent =
        "›";


    header.appendChild(arrow);


    // ========================================================
    // PARADES
    // ========================================================

    const stopsContainer =
        document.createElement("div");


    stopsContainer.className =
        "stops";


    if (
        train.stops &&
        train.stops.length > 0
    ) {

        train.stops.forEach(stop => {

            const stopElement =
                document.createElement("div");


            stopElement.className =
                "stop";


            // ------------------------------------------------
            // NOM DE L'ESTACIÓ
            // ------------------------------------------------

            const stopName =
                document.createElement("div");


            stopName.className =
                "stop-name";


            stopName.textContent =
                stop.station ||
                stop.stop_name ||
                stop.name ||
                "";


            // ------------------------------------------------
            // HORARIS
            // ------------------------------------------------

            const stopTimes =
                document.createElement("div");


            stopTimes.className =
                "stop-times";


            // ------------------------------------------------
            // HORARI TEÒRIC
            // ------------------------------------------------

            const scheduled =
                document.createElement("span");


            scheduled.className =
                "stop-scheduled";


            scheduled.textContent =
                minutesToTime(
                    stop.scheduled_arrival
                );


            // ------------------------------------------------
            // HORA REAL / ESTIMADA
            // ------------------------------------------------

            const actual =
                document.createElement("span");


            actual.className =
                "stop-actual";


            if (
                stop.actual_minutes !== null &&
                stop.actual_minutes !== undefined
            ) {

                actual.textContent =
                    minutesToTime(
                        stop.actual_minutes
                    );

            } else if (
                stop.actual_time
            ) {

                actual.textContent =
                    stop.actual_time.substring(
                        11,
                        16
                    );

            } else {

                actual.textContent =
                    "--:--";
            }


            stopTimes.appendChild(scheduled);
            stopTimes.appendChild(actual);


            // ------------------------------------------------
            // RETARD
            // ------------------------------------------------

            if (
                stop.delay_minutes !== null &&
                stop.delay_minutes !== undefined &&
                stop.delay_minutes !== 0
            ) {

                const stopDelay =
                    document.createElement("span");


                stopDelay.className =
                    "stop-delay";


                if (stop.delay_minutes > 0) {

                    stopDelay.textContent =
                        `+${stop.delay_minutes} min`;

                } else {

                    stopDelay.textContent =
                        `${stop.delay_minutes} min`;
                }


                stopTimes.appendChild(stopDelay);
            }


            stopElement.appendChild(stopName);
            stopElement.appendChild(stopTimes);


            stopsContainer.appendChild(
                stopElement
            );

        });

    } else {

        stopsContainer.innerHTML =
            "<p>No hi ha informació de parades.</p>";
    }


    // ========================================================
    // DEVOLUCIÓ EXPRESS
    // ========================================================

    if (
        finalDelay !== null &&
        finalDelay > 15
    ) {

        const refund =
            document.createElement("div");


        refund.className =
            "refund-message";


        refund.textContent =
            "Sí es pot sol·licitar devolució express";


        stopsContainer.appendChild(
            refund
        );
    }


    // ========================================================
    // CLICK PER EXPANDIR
    // ========================================================

    header.addEventListener(
        "click",
        () => {

            article.classList.toggle(
                "expanded"
            );
        }
    );


    article.appendChild(header);
    article.appendChild(stopsContainer);


    return article;
}


// ============================================================
// ACTIVAR HISTÒRIC
// ============================================================

function enableHistory() {

    showHistory = true;

    updateHistoryButton();

    loadData();
}


// ============================================================
// DESACTIVAR HISTÒRIC
// ============================================================

function disableHistory() {

    showHistory = false;

    updateHistoryButton();

    loadData();
}


// ============================================================
// ACTUALITZAR BOTÓ D'HISTÒRIC
// ============================================================

function updateHistoryButton() {

    if (!toggleHistoryButton) {
        return;
    }


    if (showHistory) {

        toggleHistoryButton.textContent =
            "Ocultar trens ja arribats";

    } else {

        toggleHistoryButton.textContent =
            "Consultar trens ja arribats";
    }
}


// ============================================================
// CLICK BOTÓ HISTÒRIC
// ============================================================

if (toggleHistoryButton) {

    toggleHistoryButton.addEventListener(
        "click",
        () => {

            if (showHistory) {

                disableHistory();

            } else {

                enableHistory();
            }
        }
    );
}


// ============================================================
// CANVI DE SENTIT
// ============================================================

directionSelect.addEventListener(
    "change",
    () => {

        loadData();
    }
);


// ============================================================
// CANVI DE DATA
// ============================================================

dateInput.addEventListener(
    "change",
    () => {

        // Quan canviem de dia tornem
        // a la vista normal.

        showHistory = false;

        updateHistoryButton();

        loadData();
    }
);


// ============================================================
// INICIALITZACIÓ
// ============================================================

dateInput.value =
    getTodayLocal();


updateHistoryButton();


loadData();


// ============================================================
// ACTUALITZACIÓ AUTOMÀTICA
// ============================================================
//
// Cada minut tornem a carregar les dades.
//
// Això permet que:
// - un tren pendent passi a circulació
// - un tren circulant passi a acabat
// - apareguin nous retards
// - desapareguin els trens arribats
//
// ============================================================

setInterval(
    () => {

        loadData();

    },
    60 * 1000
);
