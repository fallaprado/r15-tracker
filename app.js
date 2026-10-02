const directionSelect = document.getElementById("direction");
const dateInput = document.getElementById("date");
const trainsContainer = document.getElementById("trains");
const summaryContainer = document.getElementById("summary");
const toggleHistoryButton = document.getElementById("toggleHistory");

let showHistory = false;
let currentData = null;


// ============================================================
// DATA
// ============================================================

function getTodayString() {

    const now = new Date();

    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
}


// ============================================================
// TIME
// ============================================================

function parseTimeToMinutes(value) {

    if (
        value === undefined ||
        value === null ||
        value === ""
    ) {
        return null;
    }

    // Minuts des de mitjanit
    if (
        typeof value === "number" &&
        value >= 0 &&
        value < 1440
    ) {
        return value;
    }

    // Timestamp Unix
    if (
        typeof value === "number" &&
        value > 1000000000
    ) {
        const date = new Date(value * 1000);

        return (
            date.getHours() * 60 +
            date.getMinutes()
        );
    }

    const stringValue = String(value).trim();

    // HH:MM
    const match = stringValue.match(
        /^(\d{1,2}):(\d{2})/
    );

    if (match) {

        return (
            Number(match[1]) * 60 +
            Number(match[2])
        );
    }

    // ISO / datetime
    const date = new Date(stringValue);

    if (!Number.isNaN(date.getTime())) {

        return (
            date.getHours() * 60 +
            date.getMinutes()
        );
    }

    return null;
}


function getNowMinutes() {

    const now = new Date();

    return (
        now.getHours() * 60 +
        now.getMinutes()
    );
}


function formatTime(value) {

    if (
        value === undefined ||
        value === null ||
        value === ""
    ) {
        return "--:--";
    }

    // Timestamp Unix
    if (
        typeof value === "number" &&
        value > 1000000000
    ) {

        const date = new Date(value * 1000);

        return (
            String(date.getHours()).padStart(2, "0") +
            ":" +
            String(date.getMinutes()).padStart(2, "0")
        );
    }

    const stringValue = String(value).trim();

    // HH:MM
    const match = stringValue.match(
        /^(\d{1,2}):(\d{2})/
    );

    if (match) {

        return (
            String(match[1]).padStart(2, "0") +
            ":" +
            match[2]
        );
    }

    // ISO / datetime
    const date = new Date(stringValue);

    if (!Number.isNaN(date.getTime())) {

        return (
            String(date.getHours()).padStart(2, "0") +
            ":" +
            String(date.getMinutes()).padStart(2, "0")
        );
    }

    return stringValue;
}


// ============================================================
// DELAYS
// ============================================================

function getDelayMinutes(stop) {

    if (!stop) {
        return null;
    }

    const values = [

        stop.delay_minutes,

        stop.realtime_delay_minutes,

        stop.delay,

        stop.arrival_delay_minutes,

        stop.departure_delay_minutes

    ];

    for (const value of values) {

        if (
            value !== undefined &&
            value !== null &&
            value !== "" &&
            !Number.isNaN(Number(value))
        ) {

            return Math.round(Number(value));
        }
    }


    if (
        stop.delay_seconds !== undefined &&
        stop.delay_seconds !== null &&
        !Number.isNaN(Number(stop.delay_seconds))
    ) {

        return Math.round(
            Number(stop.delay_seconds) / 60
        );
    }


    return null;
}


// ============================================================
// DEPARTURE
// ============================================================

function getDepartureTime(train) {

    if (!train) {
        return null;
    }

    const values = [

        train.departure_time,

        train.departure,

        train.start_time,

        train.origin_departure

    ];

    for (const value of values) {

        if (value !== undefined && value !== null) {
            return value;
        }
    }


    if (
        Array.isArray(train.stops) &&
        train.stops.length > 0
    ) {

        const firstStop = train.stops[0];

        return (

            firstStop.departure_time ||

            firstStop.departure ||

            firstStop.arrival_time ||

            firstStop.arrival ||

            firstStop.time ||

            null
        );
    }


    return null;
}


// ============================================================
// ARRIVAL
// ============================================================

function getArrivalTime(train) {

    if (!train) {
        return null;
    }


    const values = [

        train.arrival_time,

        train.arrival,

        train.end_time,

        train.destination_arrival

    ];

    for (const value of values) {

        if (value !== undefined && value !== null) {
            return value;
        }
    }


    if (
        Array.isArray(train.stops) &&
        train.stops.length > 0
    ) {

        const lastStop =
            train.stops[train.stops.length - 1];

        return (

            lastStop.arrival_time ||

            lastStop.arrival ||

            lastStop.departure_time ||

            lastStop.departure ||

            lastStop.time ||

            null
        );
    }


    return null;
}


// ============================================================
// LAST STOP
// ============================================================

function getLastStop(train) {

    if (
        !train ||
        !Array.isArray(train.stops) ||
        train.stops.length === 0
    ) {
        return null;
    }

    return train.stops[
        train.stops.length - 1
    ];
}


// ============================================================
// ACTUAL ARRIVAL
// ============================================================

function getActualArrivalMinutes(train) {

    const lastStop = getLastStop(train);

    if (!lastStop) {
        return null;
    }


    const values = [

        lastStop.actual_time,

        lastStop.actual,

        lastStop.realtime_time,

        lastStop.real_time,

        lastStop.arrival_actual,

        lastStop.departure_actual,

        lastStop.realtime_event

    ];


    for (const value of values) {

        const minutes =
            parseTimeToMinutes(value);

        if (minutes !== null) {
            return minutes;
        }
    }


    return null;
}


// ============================================================
// TRAIN ARRIVED?
// ============================================================

function hasTrainArrived(train, selectedDate) {

    if (!train) {
        return false;
    }


    // Camps explícits

    if (
        train.arrived === true ||
        train.has_arrived === true ||
        train.finished === true ||
        train.completed === true
    ) {
        return true;
    }


    // Si la data ja ha passat

    const today = getTodayString();

    if (selectedDate < today) {
        return true;
    }


    // Si és una data futura

    if (selectedDate > today) {
        return false;
    }


    // Avui: primer mirem hora real d'arribada

    const actualArrival =
        getActualArrivalMinutes(train);

    if (actualArrival !== null) {

        return actualArrival <= getNowMinutes();
    }


    // Si no tenim hora real,
    // utilitzem arribada teòrica + retard conegut

    const arrival =
        getArrivalTime(train);

    const arrivalMinutes =
        parseTimeToMinutes(arrival);

    if (arrivalMinutes !== null) {

        const lastStop =
            getLastStop(train);

        const delay =
            getDelayMinutes(lastStop);

        const finalDelay =
            delay !== null
                ? Math.max(0, delay)
                : 0;

        return (
            arrivalMinutes + finalDelay
            <= getNowMinutes()
        );
    }


    return false;
}


// ============================================================
// DEPARTED?
// ============================================================

function hasTrainDeparted(train) {

    const departure =
        getDepartureTime(train);

    const departureMinutes =
        parseTimeToMinutes(departure);

    if (departureMinutes === null) {
        return false;
    }

    return (
        departureMinutes <= getNowMinutes()
    );
}


// ============================================================
// FINAL DELAY
// ============================================================

function getFinalDelay(train) {

    if (!train) {
        return 0;
    }


    if (
        train.final_delay_minutes !== undefined &&
        train.final_delay_minutes !== null
    ) {

        return Math.round(
            Number(train.final_delay_minutes)
        );
    }


    if (
        train.realtime_trip_delay_minutes !== undefined &&
        train.realtime_trip_delay_minutes !== null
    ) {

        return Math.round(
            Number(train.realtime_trip_delay_minutes)
        );
    }


    const lastStop =
        getLastStop(train);

    return getDelayMinutes(lastStop) || 0;
}


// ============================================================
// STATUS
// ============================================================

function getTrainStatus(train, selectedDate) {

    const arrived =
        hasTrainArrived(
            train,
            selectedDate
        );

    const delay =
        getFinalDelay(train);


    if (arrived) {

        if (delay > 15) {
            return "late";
        }

        return "finished";
    }


    if (!hasTrainDeparted(train)) {
        return "pending";
    }


    if (delay >= 4) {
        return "warning";
    }


    return "running";
}


// ============================================================
// STATUS TEXT
// ============================================================

function getStatusText(status, train) {

    const delay =
        getFinalDelay(train);


    switch (status) {

        case "pending":
            return "Encara no ha sortit";


        case "running":

            if (delay > 0) {
                return `En circulació · +${delay} min`;
            }

            return "En circulació · en hora";


        case "warning":
            return `En circulació · +${delay} min`;


        case "late":
            return `Arribat · +${delay} min`;


        case "finished":
            return "Arribat";


        default:
            return "";
    }
}


// ============================================================
// TRAIN ID
// ============================================================

function getTrainId(train) {

    return (

        train.trip_id ||

        train.train_id ||

        train.id ||

        train.tripId ||

        "Tren"
    );
}


// ============================================================
// STATION NAME
// ============================================================

function getStationName(stop) {

    if (!stop) {
        return "Parada";
    }

    return (

        stop.stop_name ||

        stop.station_name ||

        stop.station ||

        stop.name ||

        stop.stop ||

        stop.stopId ||

        stop.stop_id ||

        "Parada"
    );
}


// ============================================================
// THEORETICAL TIME
// ============================================================

function getTheoreticalTime(stop) {

    if (!stop) {
        return null;
    }


    return (

        stop.time ||

        stop.departure_time ||

        stop.arrival_time ||

        stop.departure ||

        stop.arrival ||

        stop.scheduled_time ||

        stop.scheduled_arrival ||

        stop.scheduled_departure ||

        stop.theoretical_time ||

        stop.theoretical_arrival ||

        stop.theoretical_departure ||

        null
    );
}


// ============================================================
// REALTIME TIME
// ============================================================

function getRealtimeTime(stop) {

    if (!stop) {
        return null;
    }


    return (

        stop.actual_time ||

        stop.actual ||

        stop.realtime_time ||

        stop.real_time ||

        stop.arrival_actual ||

        stop.departure_actual ||

        stop.predicted_time ||

        stop.estimated_time ||

        null
    );
}


// ============================================================
// RENDER STOPS
// ============================================================

function renderStops(train) {

    if (
        !Array.isArray(train.stops) ||
        train.stops.length === 0
    ) {

        return `
            <div class="stops">
                <p class="no-stops">
                    No hi ha informació de parades.
                </p>
            </div>
        `;
    }


    let html = `

        <div class="stops">

            <div class="stops-title">
                Parades
            </div>

            <div class="stops-header">

                <span>Estació</span>

                <span>Hora de pas</span>

            </div>
    `;


    for (const stop of train.stops) {

        const station =
            getStationName(stop);


        const theoretical =
            getTheoreticalTime(stop);


        const realtime =
            getRealtimeTime(stop);


        const delay =
            getDelayMinutes(stop);


        let realtimeHtml = "";


        // Hora real o estimada

        if (realtime) {

            realtimeHtml = `

                <span class="actual-time">

                    ${formatTime(realtime)}

                </span>

            `;

        } else if (
            delay !== null &&
            theoretical
        ) {

            const theoreticalMinutes =
                parseTimeToMinutes(
                    theoretical
                );


            if (
                theoreticalMinutes !== null
            ) {

                const estimatedMinutes =
                    theoreticalMinutes +
                    delay;


                const hours =
                    Math.floor(
                        estimatedMinutes / 60
                    ) % 24;


                const minutes =
                    estimatedMinutes % 60;


                realtimeHtml = `

                    <span class="estimated-time">

                        ${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}

                    </span>

                `;
            }
        }


        // Retard

        let delayHtml = "";


        if (
            delay !== null &&
            delay !== 0
        ) {

            const prefix =
                delay > 0
                    ? "+"
                    : "";


            delayHtml = `

                <span class="stop-delay">

                    ${prefix}${delay} min

                </span>

            `;
        }


        html += `

            <div class="stop-row">

                <div class="stop-name">

                    ${station}

                </div>


                <div class="stop-times">

                    <span class="theoretical-time">

                        ${formatTime(theoretical)}

                    </span>


                    ${realtimeHtml}


                    ${delayHtml}

                </div>

            </div>

        `;
    }


    html += `

        </div>

    `;


    return html;
}


// ============================================================
// RENDER TRAIN
// ============================================================

function renderTrain(train, selectedDate) {

    const status =
        getTrainStatus(
            train,
            selectedDate
        );


    const delay =
        getFinalDelay(train);


    const trainId =
        getTrainId(train);


    const departure =
        getDepartureTime(train);


    const arrival =
        getArrivalTime(train);


    const statusText =
        getStatusText(
            status,
            train
        );


    const expressRefund =
        delay > 15;


    return `

        <article
            class="train ${status}"
            data-train-id="${trainId}"
        >

            <div class="train-main">

                <div class="train-left">

                    <div class="train-id">

                        🚆 ${trainId}

                    </div>


                    <div class="train-route">

                        <span>

                            ${formatTime(departure)}

                        </span>

                        <span class="arrow">

                            →

                        </span>

                        <span>

                            ${formatTime(arrival)}

                        </span>

                    </div>

                </div>


                <div class="train-right">

                    <div class="status">

                        <span class="status-dot"></span>

                        ${statusText}

                    </div>

                    ${
                        expressRefund
                            ? `
                                <div class="refund">

                                    Sí es pot sol·licitar
                                    devolució express

                                </div>
                            `
                            : ""
                    }

                </div>

            </div>


            ${renderStops(train)}

        </article>

    `;
}


// ============================================================
// RENDER SUMMARY
// ============================================================

function renderSummary(
    total,
    visible,
    arrived
) {

    summaryContainer.innerHTML = `

        <div class="summary">

            <strong>${visible}</strong>
            trens mostrats

            ${
                showHistory
                    ? `
                        · ${arrived}
                        trens arribats
                    `
                    : ""
            }

        </div>

    `;
}


// ============================================================
// MAIN RENDER
// ============================================================

function render(data) {

    if (!data) {
        return;
    }


    const selectedDate =
        dateInput.value;


    let trains =
        data.trains ||
        data.circulations ||
        [];


    // Filtrar sentit

    const direction =
        directionSelect.value;


    trains =
        trains.filter(train => {

            const trainDirection =
                train.direction ||
                train.route_direction ||
                train.direction_code;


            if (!trainDirection) {
                return true;
            }


            return (
                trainDirection === direction
            );
        });


    const processed =
        trains.map(train => {

            return {

                train,

                status:
                    getTrainStatus(
                        train,
                        selectedDate
                    )

            };

        });


    let visible;


    // ========================================================
    // VISTA NORMAL
    // ========================================================

    if (!showHistory) {

        // IMPORTANT:
        // qualsevol tren que ja hagi arribat
        // desapareix de la vista principal.

        visible =
            processed
                .filter(item => {

                    return !hasTrainArrived(
                        item.train,
                        selectedDate
                    );

                })
                .map(item => item.train);

    }


    // ========================================================
    // HISTORIAL
    // ========================================================

    else {

        visible =
            processed
                .filter(item => {

                    return hasTrainArrived(
                        item.train,
                        selectedDate
                    );

                })
                .map(item => item.train);

    }


    // Ordenar per hora de sortida

    visible.sort((a, b) => {

        const timeA =
            parseTimeToMinutes(
                getDepartureTime(a)
            ) ?? 9999;


        const timeB =
            parseTimeToMinutes(
                getDepartureTime(b)
            ) ?? 9999;


        return timeA - timeB;

    });


    // Resum

    const arrivedCount =
        processed.filter(item =>
            hasTrainArrived(
                item.train,
                selectedDate
            )
        ).length;


    renderSummary(
        trains.length,
        visible.length,
        arrivedCount
    );


    // Cap tren

    if (visible.length === 0) {

        trainsContainer.innerHTML = `

            <div class="empty">

                ${
                    showHistory
                        ? "No hi ha trens ja arribats."
                        : "No hi ha trens en circulació o pendents."
                }

            </div>

        `;

        return;
    }


    // Render

    trainsContainer.innerHTML =
        visible
            .map(train =>
                renderTrain(
                    train,
                    selectedDate
                )
            )
            .join("");


    // Click per desplegar parades

    document
        .querySelectorAll(".train")
        .forEach(trainElement => {

            trainElement.addEventListener(
                "click",
                () => {

                    trainElement.classList.toggle(
                        "expanded"
                    );

                }
            );

        });
}


// ============================================================
// LOAD DATA
// ============================================================

async function loadData() {

    const date =
        dateInput.value;


    if (!date) {
        return;
    }


    trainsContainer.innerHTML = `

        <p class="loading">

            Carregant dades...

        </p>

    `;


    try {

        const response =
            await fetch(
                `data/${date}.json?t=${Date.now()}`
            );


        if (!response.ok) {

            throw new Error(
                `HTTP ${response.status}`
            );

        }


        const data =
            await response.json();


        currentData = data;


        render(data);


    } catch (error) {

        console.error(
            "Error carregant dades:",
            error
        );


        trainsContainer.innerHTML = `

            <div class="error">

                ❌ No s'han pogut carregar
                les dades d'aquest dia.

            </div>

        `;
    }
}


// ============================================================
// HISTORY BUTTON
// ============================================================

toggleHistoryButton.addEventListener(
    "click",
    () => {

        showHistory =
            !showHistory;


        if (showHistory) {

            toggleHistoryButton.textContent =
                "← Tornar als trens actuals";

            toggleHistoryButton.classList.add(
                "active"
            );

        } else {

            toggleHistoryButton.textContent =
                "Consultar trens ja arribats";

            toggleHistoryButton.classList.remove(
                "active"
            );
        }


        if (currentData) {
            render(currentData);
        }

    }
);


// ============================================================
// CONTROLS
// ============================================================

directionSelect.addEventListener(
    "change",
    loadData
);


dateInput.addEventListener(
    "change",
    loadData
);


// ============================================================
// INIT
// ============================================================

dateInput.value =
    getTodayString();


loadData();


// ============================================================
// AUTO REFRESH
// ============================================================

// Actualitza la pantalla cada minut.
// Les dades noves les proporciona GitHub Actions.

setInterval(
    loadData,
    60 * 1000
);
