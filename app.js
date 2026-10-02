const directionSelect = document.getElementById("direction");
const dateInput = document.getElementById("date");
const trainsContainer = document.getElementById("trains");
const summaryContainer = document.getElementById("summary");

// Estat de la vista
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
// HH:MM -> MINUTS
// ============================================================

function timeToMinutes(timeString) {

    if (!timeString) {
        return null;
    }

    const match = String(timeString).match(/(\d{1,2}):(\d{2})/);

    if (!match) {
        return null;
    }

    return (
        parseInt(match[1], 10) * 60 +
        parseInt(match[2], 10)
    );
}


// ============================================================
// MINUTS -> HH:MM
// ============================================================

function minutesToTime(minutes) {

    if (
        minutes === null ||
        minutes === undefined ||
        isNaN(minutes)
    ) {
        return "--:--";
    }

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
// FORMAT DATA
// ============================================================

function formatDate(dateString) {

    const parts = dateString.split("-");

    if (parts.length !== 3) {
        return dateString;
    }

    return `${parts[2]}/${parts[1]}/${parts[0]}`;
}


// ============================================================
// OBTENIR HORA DE SORTIDA
// ============================================================

function getDepartureMinutes(train) {

    if (train.departure) {

        const match = String(train.departure)
            .match(/T(\d{2}):(\d{2})/);

        if (match) {

            return (
                parseInt(match[1], 10) * 60 +
                parseInt(match[2], 10)
            );
        }
    }

    if (train.departure_minutes !== undefined) {
        return Number(train.departure_minutes);
    }

    return null;
}


// ============================================================
// OBTENIR HORA D'ARRIBADA
// ============================================================

function getArrivalMinutes(train) {

    if (train.arrival) {

        const match = String(train.arrival)
            .match(/T(\d{2}):(\d{2})/);

        if (match) {

            return (
                parseInt(match[1], 10) * 60 +
                parseInt(match[2], 10)
            );
        }
    }

    if (train.arrival_minutes !== undefined) {
        return Number(train.arrival_minutes);
    }

    // Si no tenim arrival del tren,
    // intentem obtenir-lo de l'última parada.

    if (
        train.stops &&
        train.stops.length > 0
    ) {

        const lastStop =
            train.stops[train.stops.length - 1];

        if (
            lastStop.scheduled_arrival !== undefined &&
            lastStop.scheduled_arrival !== null
        ) {

            return Number(
                lastStop.scheduled_arrival
            );
        }
    }

    return null;
}


// ============================================================
// RETARD ACTUAL
// ============================================================

function getCurrentTrainDelay(train) {

    let latestDelay = null;

    if (train.stops) {

        train.stops.forEach(stop => {

            if (
                stop.delay_minutes !== null &&
                stop.delay_minutes !== undefined
            ) {

                const delay =
                    Number(stop.delay_minutes);

                if (!isNaN(delay)) {
                    latestDelay = delay;
                }
            }
        });
    }


    if (latestDelay !== null) {
        return latestDelay;
    }


    if (
        train.realtime_trip_delay_minutes !== null &&
        train.realtime_trip_delay_minutes !== undefined
    ) {

        return Number(
            train.realtime_trip_delay_minutes
        );
    }


    if (
        train.final_delay_minutes !== null &&
        train.final_delay_minutes !== undefined
    ) {

        return Number(
            train.final_delay_minutes
        );
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

        return Number(
            train.final_delay_minutes
        );
    }

    return null;
}


// ============================================================
// SABER SI JA HA ARRIBAT
// ============================================================
//
// Aquesta és la part important.
//
// No depenem únicament de:
//
//     train.arrived === true
//
// També comprovem:
// - arrived = true / "true" / 1
// - hora real de l'última parada
// - hora prevista d'arribada + retard
// - si la data seleccionada és anterior a avui
//
// ============================================================

function hasTrainArrived(train, selectedDate) {

    // --------------------------------------------------------
    // 1. Si el collector ja ho sap
    // --------------------------------------------------------

    if (
        train.arrived === true ||
        train.arrived === "true" ||
        train.arrived === 1 ||
        train.arrived === "1"
    ) {

        return true;
    }


    // --------------------------------------------------------
    // 2. Si la data és anterior a avui,
    //    evidentment el tren ja ha acabat.
    // --------------------------------------------------------

    const today = getTodayLocal();

    if (selectedDate < today) {
        return true;
    }


    // --------------------------------------------------------
    // 3. Data posterior a avui
    // --------------------------------------------------------

    if (selectedDate > today) {
        return false;
    }


    // --------------------------------------------------------
    // 4. AVUI:
    //    comprovem hora actual
    // --------------------------------------------------------

    const now = new Date();

    const currentMinutes =
        now.getHours() * 60 +
        now.getMinutes();


    // --------------------------------------------------------
    // 5. Hora d'arribada prevista
    // --------------------------------------------------------

    let arrivalMinutes =
        getArrivalMinutes(train);


    if (arrivalMinutes !== null) {

        const delay =
            getFinalDelay(train);

        if (
            delay !== null &&
            delay > 0
        ) {

            arrivalMinutes += delay;
        }


        if (
            currentMinutes >= arrivalMinutes &&
            train.started !== false
        ) {

            return true;
        }
    }


    // --------------------------------------------------------
    // 6. Última parada amb hora real
    // --------------------------------------------------------

    if (
        train.stops &&
        train.stops.length > 0
    ) {

        const lastStop =
            train.stops[train.stops.length - 1];


        // actual_minutes
        if (
            lastStop.actual_minutes !== null &&
            lastStop.actual_minutes !== undefined
        ) {

            const actual =
                Number(lastStop.actual_minutes);

            if (
                !isNaN(actual) &&
                currentMinutes >= actual
            ) {

                return true;
            }
        }


        // actual_time
        if (lastStop.actual_time) {

            const match =
                String(lastStop.actual_time)
                    .match(/T(\d{2}):(\d{2})/);

            if (match) {

                const actualMinutes =
                    parseInt(match[1], 10) * 60 +
                    parseInt(match[2], 10);


                if (
                    currentMinutes >= actualMinutes
                ) {

                    return true;
                }
            }
        }
    }


    return false;
}


// ============================================================
// ESTAT DEL TREN
// ============================================================

function getTrainStatus(train, selectedDate) {

    const currentDelay =
        getCurrentTrainDelay(train);

    const finalDelay =
        getFinalDelay(train);


    // --------------------------------------------------------
    // RETARD >15 MINUTS
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
    // JA ARRIBAT
    // --------------------------------------------------------

    if (
        hasTrainArrived(
            train,
            selectedDate
        )
    ) {

        return "finished";
    }


    // --------------------------------------------------------
    // ENCARA NO HA SORTIT
    // --------------------------------------------------------

    if (
        train.started === false ||
        train.started === "false" ||
        train.started === 0 ||
        train.started === "0"
    ) {

        return "pending";
    }


    // --------------------------------------------------------
    // CIRCULANT
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
// ORIGEN
// ============================================================

function getTrainOrigin(train) {

    if (
        train.stops &&
        train.stops.length > 0
    ) {

        const first =
            train.stops[0];

        return (
            first.station ||
            first.stop_name ||
            first.name ||
            ""
        );
    }

    return train.origin || "";
}


// ============================================================
// DESTÍ
// ============================================================

function getTrainDestination(train) {

    if (
        train.stops &&
        train.stops.length > 0
    ) {

        const last =
            train.stops[
                train.stops.length - 1
            ];

        return (
            last.station ||
            last.stop_name ||
            last.name ||
            ""
        );
    }

    return train.destination || "";
}


// ============================================================
// CREAR / GARANTIR BOTÓ HISTÒRIC
// ============================================================

function ensureHistoryButton() {

    let button =
        document.getElementById(
            "toggleHistory"
        );


    // Si no existeix a l'HTML,
    // el creem automàticament.

    if (!button) {

        button =
            document.createElement("button");

        button.id =
            "toggleHistory";

        button.className =
            "history-button";


        const controls =
            document.querySelector(
                ".controls"
            );


        if (controls) {

            controls.insertAdjacentElement(
                "afterend",
                button
            );

        } else {

            document.body.prepend(button);
        }
    }


    button.textContent =
        showHistory
            ? "Ocultar trens ja arribats"
            : "Consultar trens ja arribats";


    // Evitem afegir múltiples listeners.
    if (!button.dataset.listenerAttached) {

        button.addEventListener(
            "click",
            () => {

                showHistory =
                    !showHistory;

                button.textContent =
                    showHistory
                        ? "Ocultar trens ja arribats"
                        : "Consultar trens ja arribats";

                loadData();
            }
        );


        button.dataset.listenerAttached =
            "true";
    }


    return button;
}


// ============================================================
// CARREGAR DADES
// ============================================================

async function loadData() {

    const date =
        dateInput.value;


    if (!date) {
        return;
    }


    ensureHistoryButton();


    trainsContainer.innerHTML =
        '<p class="loading">Carregant dades...</p>';


    try {

        const response =
            await fetch(
                `data/${date}.json?t=${Date.now()}`
            );


        if (!response.ok) {

            throw new Error(
                `No s'ha pogut carregar data/${date}.json`
            );
        }


        const data =
            await response.json();


        render(data);


    } catch (error) {

        console.error(
            "Error carregant dades:",
            error
        );


        trainsContainer.innerHTML = `
            <p class="error">
                No hi ha dades disponibles
                per al ${formatDate(date)}.
            </p>
        `;


        summaryContainer.innerHTML = "";
    }
}


// ============================================================
// RENDERITZAR
// ============================================================

function render(data) {

    const direction =
        directionSelect.value;

    const selectedDate =
        dateInput.value;


    let trains =
        data.trains || [];


    // --------------------------------------------------------
    // SENTIT
    // --------------------------------------------------------

    trains =
        trains.filter(
            train =>
                train.direction === direction
        );


    // --------------------------------------------------------
    // ORDENAR
    // --------------------------------------------------------

    trains.sort(
        (a, b) =>
            (
                getDepartureMinutes(a) ?? 9999
            ) -
            (
                getDepartureMinutes(b) ?? 9999
            )
    );


    // --------------------------------------------------------
    // VISTA NORMAL
    // --------------------------------------------------------
    //
    // Només:
    //
    // - pendents
    // - circulant
    // - retardats
    //
    // Els acabats desapareixen.
    //
    // --------------------------------------------------------

    if (!showHistory) {

        trains =
            trains.filter(
                train => {

                    const status =
                        getTrainStatus(
                            train,
                            selectedDate
                        );


                    return (
                        status !== "finished"
                    );
                }
            );
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


    const visibleTrains =
        trains.length;


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
                ${totalTrains}
                circulacions previstes
            </div>
        `;
    }


    // ========================================================
    // CAP TREN
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


            const emptyButton =
                document.getElementById(
                    "emptyHistoryButton"
                );


            if (emptyButton) {

                emptyButton.addEventListener(
                    "click",
                    () => {

                        showHistory = true;

                        ensureHistoryButton();

                        loadData();
                    }
                );
            }
        }

        return;
    }


    // ========================================================
    // CREAR TRENS
    // ========================================================

    trainsContainer.innerHTML = "";


    trains.forEach(
        train => {

            trainsContainer.appendChild(
                createTrain(
                    train,
                    selectedDate
                )
            );
        }
    );
}


// ============================================================
// CREAR TARGETA DEL TREN
// ============================================================

function createTrain(
    train,
    selectedDate
) {

    const status =
        getTrainStatus(
            train,
            selectedDate
        );


    const currentDelay =
        getCurrentTrainDelay(train);


    const finalDelay =
        getFinalDelay(train);


    const article =
        document.createElement("article");


    article.className =
        `train ${status}`;


    // ========================================================
    // HEADER
    // ========================================================

    const header =
        document.createElement("div");


    header.className =
        "train-header";


    // ========================================================
    // INFORMACIÓ
    // ========================================================

    const mainInfo =
        document.createElement("div");


    mainInfo.className =
        "train-main";


    const trainNumber =
        document.createElement("div");


    trainNumber.className =
        "train-number";


    trainNumber.textContent =
        train.train_id ||
        train.train_number ||
        train.trip_id ||
        "R15";


    const route =
        document.createElement("div");


    route.className =
        "train-route";


    route.textContent =
        `${getTrainOrigin(train)} → ${getTrainDestination(train)}`;


    mainInfo.appendChild(
        trainNumber
    );

    mainInfo.appendChild(
        route
    );


    // ========================================================
    // HORARIS
    // ========================================================

    const times =
        document.createElement("div");


    times.className =
        "train-times";


    const departure =
        document.createElement("div");


    departure.innerHTML = `
        <span class="time-label">
            Sortida
        </span>

        <strong>
            ${minutesToTime(
                getDepartureMinutes(train)
            )}
        </strong>
    `;


    const arrival =
        document.createElement("div");


    arrival.innerHTML = `
        <span class="time-label">
            Arribada
        </span>

        <strong>
            ${minutesToTime(
                getArrivalMinutes(train)
            )}
        </strong>
    `;


    times.appendChild(
        departure
    );

    times.appendChild(
        arrival
    );


    // ========================================================
    // ESTAT
    // ========================================================

    const statusElement =
        document.createElement("div");


    statusElement.className =
        "train-status";


    if (
        status === "running" ||
        status === "warning" ||
        status === "late"
    ) {

        const liveDot =
            document.createElement("span");


        liveDot.className =
            "live-dot";


        statusElement.appendChild(
            liveDot
        );
    }


    const statusText =
        document.createElement("span");


    statusText.textContent =
        getStatusText(status);


    statusElement.appendChild(
        statusText
    );


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


            statusElement.appendChild(
                delay
            );
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


        statusElement.appendChild(
            delay
        );
    }


    header.appendChild(
        mainInfo
    );

    header.appendChild(
        times
    );

    header.appendChild(
        statusElement
    );


    // ========================================================
    // FLETXA
    // ========================================================

    const arrow =
        document.createElement("span");


    arrow.className =
        "train-arrow";


    arrow.textContent =
        "›";


    header.appendChild(
        arrow
    );


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

        train.stops.forEach(
            stop => {

                const stopElement =
                    document.createElement("div");


                stopElement.className =
                    "stop";


                const stopName =
                    document.createElement("div");


                stopName.className =
                    "stop-name";


                stopName.textContent =
                    stop.station ||
                    stop.stop_name ||
                    stop.name ||
                    "";


                const stopTimes =
                    document.createElement("div");


                stopTimes.className =
                    "stop-times";


                // --------------------------------------------
                // HORARI TEÒRIC
                // --------------------------------------------

                const scheduled =
                    document.createElement("span");


                scheduled.className =
                    "stop-scheduled";


                scheduled.textContent =
                    minutesToTime(
                        stop.scheduled_arrival
                    );


                // --------------------------------------------
                // HORA REAL
                // --------------------------------------------

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

                    const match =
                        String(stop.actual_time)
                            .match(
                                /T(\d{2}):(\d{2})/
                            );


                    if (match) {

                        actual.textContent =
                            `${match[1]}:${match[2]}`;

                    } else {

                        actual.textContent =
                            "--:--";
                    }

                } else {

                    actual.textContent =
                        "--:--";
                }


                stopTimes.appendChild(
                    scheduled
                );

                stopTimes.appendChild(
                    actual
                );


                // --------------------------------------------
                // RETARD
                // --------------------------------------------

                if (
                    stop.delay_minutes !== null &&
                    stop.delay_minutes !== undefined &&
                    Number(stop.delay_minutes) !== 0
                ) {

                    const stopDelay =
                        document.createElement("span");


                    stopDelay.className =
                        "stop-delay";


                    const delay =
                        Number(
                            stop.delay_minutes
                        );


                    stopDelay.textContent =
                        delay > 0
                            ? `+${delay} min`
                            : `${delay} min`;


                    stopTimes.appendChild(
                        stopDelay
                    );
                }


                stopElement.appendChild(
                    stopName
                );

                stopElement.appendChild(
                    stopTimes
                );


                stopsContainer.appendChild(
                    stopElement
                );
            }
        );

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
    // EXPANDIR
    // ========================================================

    header.addEventListener(
        "click",
        () => {

            article.classList.toggle(
                "expanded"
            );
        }
    );


    article.appendChild(
        header
    );

    article.appendChild(
        stopsContainer
    );


    return article;
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

        // Cada vegada que canviem de dia,
        // tornem a la vista principal.

        showHistory = false;

        ensureHistoryButton();

        loadData();
    }
);


// ============================================================
// INICI
// ============================================================

dateInput.value =
    getTodayLocal();


ensureHistoryButton();


loadData();


// ============================================================
// ACTUALITZACIÓ AUTOMÀTICA
// ============================================================

setInterval(
    () => {

        loadData();

    },
    60 * 1000
);
