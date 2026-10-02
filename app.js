let trains = [];
let showHistory = false;

const directionSelect = document.getElementById("direction");
const dateInput = document.getElementById("date");
const trainsContainer = document.getElementById("trains");
const summaryContainer = document.getElementById("summary");
const historyButton = document.getElementById("toggleHistory");


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

    if (value === undefined || value === null || value === "") {
        return null;
    }

    if (typeof value === "number") {

        // Unix timestamp
        if (value > 1000000000) {

            const date = new Date(value * 1000);

            return date.getHours() * 60 + date.getMinutes();
        }

        return null;
    }

    const text = String(value).trim();

    // ISO
    if (text.includes("T")) {

        const match = text.match(/T(\d{1,2}):(\d{2})/);

        if (match) {

            return (
                Number(match[1]) * 60 +
                Number(match[2])
            );
        }
    }

    // HH:MM
    const match = text.match(/^(\d{1,2}):(\d{2})/);

    if (match) {

        return (
            Number(match[1]) * 60 +
            Number(match[2])
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


function addMinutes(time, minutes) {

    if (time === null) {
        return null;
    }

    return time + minutes;
}


// ============================================================
// FORMAT TIME
// ============================================================

function formatTime(value) {

    if (
        value === undefined ||
        value === null ||
        value === ""
    ) {
        return "--:--";
    }

    if (typeof value === "number") {

        if (value > 1000000000) {

            const date = new Date(value * 1000);

            return date.toLocaleTimeString(
                "ca-ES",
                {
                    hour: "2-digit",
                    minute: "2-digit",
                    hour12: false
                }
            );
        }

        return "--:--";
    }

    const text = String(value);

    // ISO
    if (text.includes("T")) {

        const match = text.match(
            /T(\d{1,2}):(\d{2})/
        );

        if (match) {

            return `${String(match[1]).padStart(2, "0")}:${match[2]}`;
        }
    }

    // HH:MM
    const match = text.match(
        /^(\d{1,2}):(\d{2})/
    );

    if (match) {

        return `${String(match[1]).padStart(2, "0")}:${match[2]}`;
    }

    return "--:--";
}


// ============================================================
// TRAIN TIMES
// ============================================================

function getDepartureTime(train) {

    return (
        train.departure ||
        train.departure_time ||
        train.first_departure ||
        train.origin_departure ||
        train.start_time ||
        null
    );
}


function getArrivalTime(train) {

    return (
        train.arrival ||
        train.arrival_time ||
        train.final_arrival ||
        train.destination_arrival ||
        train.end_time ||
        null
    );
}


// ============================================================
// DELAY
// ============================================================

function getDelayMinutes(train) {

    const values = [

        train.realtime_trip_delay_minutes,

        train.final_delay_minutes,

        train.delay_minutes,

        train.realtime_delay_minutes

    ];

    for (const value of values) {

        if (
            value !== undefined &&
            value !== null &&
            value !== ""
        ) {

            const number = Number(value);

            if (!Number.isNaN(number)) {
                return Math.round(number);
            }
        }
    }

    return 0;
}


// ============================================================
// TRAIN ID
// ============================================================

function getTrainId(train) {

    return (
        train.train_id ||
        train.trip_id ||
        train.id ||
        "Tren"
    );
}


// ============================================================
// ARRIVAL DETECTION
// ============================================================

function isExplicitlyArrived(train) {

    const values = [

        train.arrived,

        train.has_arrived,

        train.finished,

        train.completed

    ];

    return values.some(value =>
        value === true ||
        value === "true" ||
        value === 1 ||
        value === "1"
    );
}


function getLastStop(train) {

    if (
        !Array.isArray(train.stops) ||
        train.stops.length === 0
    ) {
        return null;
    }

    return train.stops[train.stops.length - 1];
}


function getStopActualTime(stop) {

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
        stop.arrival_real ||
        stop.departure_real ||
        null
    );
}


function hasTrainArrived(train, selectedDate) {

    // Si el collector ho indica explícitament.
    if (isExplicitlyArrived(train)) {
        return true;
    }

    const today = getTodayString();

    // Qualsevol dia anterior a avui:
    // ja ha finalitzat.
    if (selectedDate < today) {
        return true;
    }

    // Dia futur.
    if (selectedDate > today) {
        return false;
    }

    // --------------------------------------------------------
    // AVUI
    // --------------------------------------------------------

    const now = getNowMinutes();

    // 1. Intentem detectar una hora REAL a l'última parada.
    const lastStop = getLastStop(train);

    if (lastStop) {

        const actualTime = getStopActualTime(lastStop);

        const actualMinutes =
            parseTimeToMinutes(actualTime);

        if (
            actualMinutes !== null &&
            actualMinutes <= now
        ) {
            return true;
        }
    }


    // 2. Mètode principal:
    // hora teòrica d'arribada + retard final conegut.
    //
    // Això permet saber, per exemple:
    //
    // Arribada prevista: 08:42
    // Retard: +7
    // Arribada estimada: 08:49
    //
    // A les 15:00 -> ja ha arribat.
    const scheduledArrival =
        parseTimeToMinutes(
            getArrivalTime(train)
        );

    if (scheduledArrival !== null) {

        const delay = getDelayMinutes(train);

        const estimatedArrival =
            addMinutes(
                scheduledArrival,
                Math.max(0, delay)
            );

        if (estimatedArrival <= now) {
            return true;
        }
    }


    return false;
}


// ============================================================
// DEPARTURE DETECTION
// ============================================================

function hasTrainDeparted(train, selectedDate) {

    const today = getTodayString();

    if (selectedDate < today) {
        return true;
    }

    if (selectedDate > today) {
        return false;
    }

    if (
        train.started === true ||
        train.started === "true" ||
        train.started === 1 ||
        train.started === "1"
    ) {
        return true;
    }

    const departureMinutes =
        parseTimeToMinutes(
            getDepartureTime(train)
        );

    if (departureMinutes === null) {
        return false;
    }

    return departureMinutes <= getNowMinutes();
}


// ============================================================
// STATUS
// ============================================================

function getTrainStatus(train, selectedDate) {

    const delay = getDelayMinutes(train);

    const arrived =
        hasTrainArrived(
            train,
            selectedDate
        );

    const departed =
        hasTrainDeparted(
            train,
            selectedDate
        );


    // Arribat >15 minuts tard:
    // continua sent vermell a l'històric.
    if (
        arrived &&
        delay > 15
    ) {
        return "late";
    }


    // Ja ha arribat.
    if (arrived) {
        return "finished";
    }


    // Encara no ha sortit.
    if (!departed) {
        return "pending";
    }


    // Circulant.
    if (delay >= 4) {
        return "warning";
    }


    return "running";
}


// ============================================================
// STATUS TEXT
// ============================================================

function getStatusText(status, delay) {

    switch (status) {

        case "pending":

            return "⚪ Encara no ha sortit";


        case "running":

            if (delay <= 0) {
                return "🟢 Circulant · puntual";
            }

            return `🟢 Circulant · +${delay} min`;


        case "warning":

            return `🟠 Circulant · +${delay} min`;


        case "late":

            return `🔴 +${delay} min`;


        case "finished":

            return "⚪ Arribat";


        default:

            return "";
    }
}


// ============================================================
// STOPS — ROBUST
// ============================================================

function getStopName(stop) {

    if (!stop) {
        return "Parada";
    }

    // Possibles estructures del JSON.
    if (typeof stop.stop === "object") {

        return (
            stop.stop.name ||
            stop.stop.stop_name ||
            stop.stop.station_name ||
            "Parada"
        );
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


function getTheoreticalArrival(stop) {

    if (!stop) {
        return null;
    }

    return (
        stop.arrival ||
        stop.arrival_time ||
        stop.scheduled_arrival ||
        stop.theoretical_arrival ||
        stop.arrival_scheduled ||
        null
    );
}


function getTheoreticalDeparture(stop) {

    if (!stop) {
        return null;
    }

    return (
        stop.departure ||
        stop.departure_time ||
        stop.scheduled_departure ||
        stop.theoretical_departure ||
        stop.departure_scheduled ||
        null
    );
}


function getStopDelay(stop) {

    if (!stop) {
        return null;
    }

    const values = [

        stop.delay_minutes,

        stop.realtime_delay_minutes,

        stop.delay,

        stop.arrival_delay_minutes,

        stop.departure_delay_minutes,

        stop.delay_seconds !== undefined
            ? Number(stop.delay_seconds) / 60
            : null

    ];

    for (const value of values) {

        if (
            value !== undefined &&
            value !== null &&
            value !== "" &&
            !Number.isNaN(Number(value))
        ) {

            return Math.round(
                Number(value)
            );
        }
    }

    return null;
}


function getStopRealtimeTime(stop) {

    if (!stop) {
        return null;
    }

    return (
        stop.actual_time ||
        stop.actual ||
        stop.realtime_time ||
        stop.real_time ||
        stop.realtime_event ||
        stop.arrival_actual ||
        stop.departure_actual ||
        stop.predicted_time ||
        stop.estimated_time ||
        null
    );
}


function renderStops(train) {

    if (
        !Array.isArray(train.stops) ||
        train.stops.length === 0
    ) {

        return `
            <div class="stops">
                <p>No hi ha informació de parades.</p>
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
                <span>Hora</span>
            </div>
    `;


    for (const stop of train.stops) {

        const station =
            getStopName(stop);


        const arrival =
            getTheoreticalArrival(stop);


        const departure =
            getTheoreticalDeparture(stop);


        const realtime =
            getStopRealtimeTime(stop);


        const delay =
            getStopDelay(stop);


        // Hora teòrica:
        // si tenim arribada, la fem servir.
        // Si no, sortida.
        const theoretical =
            arrival || departure;


        let realtimeHtml = "";


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
                parseTimeToMinutes(theoretical);

            if (theoreticalMinutes !== null) {

                const estimatedMinutes =
                    theoreticalMinutes + delay;

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
// TRAIN CARD
// ============================================================

function renderTrain(train, selectedDate) {

    const status =
        getTrainStatus(
            train,
            selectedDate
        );

    const delay =
        getDelayMinutes(train);

    const departure =
        getDepartureTime(train);

    const arrival =
        getArrivalTime(train);

    const trainId =
        getTrainId(train);

    const statusText =
        getStatusText(
            status,
            delay
        );


    let refundHtml = "";


    if (delay > 15) {

        refundHtml = `
            <div class="refund">
                Sí es pot sol·licitar devolució express
            </div>
        `;
    }


    return `
        <article
            class="train ${status}"
            data-train-id="${trainId}"
        >

            <div class="train-main">

                <div class="train-left">

                    <div class="train-number">
                        ${trainId}
                    </div>

                    <div class="train-route">

                        <span class="train-time">
                            ${formatTime(departure)}
                        </span>

                        <span class="arrow">
                            →
                        </span>

                        <span class="train-time">
                            ${formatTime(arrival)}
                        </span>

                    </div>

                </div>


                <div class="train-right">

                    <div class="train-status">
                        ${statusText}
                    </div>

                    <div class="expand-icon">
                        +
                    </div>

                </div>

            </div>


            ${refundHtml}


            ${renderStops(train)}

        </article>
    `;
}


// ============================================================
// RENDER
// ============================================================

function render() {

    const selectedDate =
        dateInput.value;


    if (!selectedDate) {

        trainsContainer.innerHTML = "";

        return;
    }


    const direction =
        directionSelect.value;


    let directionTrains =
        trains.filter(train => {

            const trainDirection =
                train.direction ||
                train.route_direction ||
                train.sense ||
                null;


            if (!trainDirection) {
                return true;
            }


            return trainDirection === direction;
        });


    const processed =
        directionTrains.map(train => ({

            train: train,

            status:
                getTrainStatus(
                    train,
                    selectedDate
                )

        }));


    // ========================================================
    // NORMAL
    // ========================================================

    if (!showHistory) {

        directionTrains =
            processed

                .filter(item => {

                    return (
                        item.status === "pending" ||
                        item.status === "running" ||
                        item.status === "warning" ||
                        item.status === "late"
                    );

                })

                .map(item => item.train);

    }


    // ========================================================
    // HISTORY
    // ========================================================

    else {

        directionTrains =
            processed

                .filter(item => {

                    return (
                        item.status === "finished" ||
                        (
                            item.status === "late" &&
                            hasTrainArrived(
                                item.train,
                                selectedDate
                            )
                        )
                    );

                })

                .map(item => item.train);

    }


    // Ordenar per sortida.
    directionTrains.sort(
        (a, b) => {

            const timeA =
                parseTimeToMinutes(
                    getDepartureTime(a)
                );

            const timeB =
                parseTimeToMinutes(
                    getDepartureTime(b)
                );


            if (timeA === null) {
                return 1;
            }

            if (timeB === null) {
                return -1;
            }


            return timeA - timeB;
        }
    );


    // ========================================================
    // SUMMARY
    // ========================================================

    const arrivedCount =
        processed.filter(
            item =>
                hasTrainArrived(
                    item.train,
                    selectedDate
                )
        ).length;


    const visibleCount =
        directionTrains.length;


    summaryContainer.innerHTML = `

        <div class="summary-box">

            <span>
                ${
                    showHistory
                        ? `${visibleCount} trens arribats`
                        : `${visibleCount} trens pendents o en circulació`
                }
            </span>

            <span>
                ${arrivedCount} arribats
            </span>

        </div>
    `;


    historyButton.textContent =
        showHistory
            ? "← Tornar als trens actuals"
            : "Consultar trens ja arribats";


    // ========================================================
    // EMPTY
    // ========================================================

    if (directionTrains.length === 0) {

        trainsContainer.innerHTML = `

            <div class="empty">

                <div class="empty-title">

                    ${
                        showHistory
                            ? "No hi ha trens arribats"
                            : "No hi ha trens pendents o en circulació"
                    }

                </div>

                <div class="empty-text">

                    ${
                        showHistory
                            ? "No s'han trobat circulacions finalitzades."
                            : "No hi ha cap tren en aquest moment."
                    }

                </div>

            </div>
        `;

        return;
    }


    // ========================================================
    // CARDS
    // ========================================================

    trainsContainer.innerHTML =
        directionTrains

            .map(train =>
                renderTrain(
                    train,
                    selectedDate
                )
            )

            .join("");


    // ========================================================
    // EXPAND
    // ========================================================

    document
        .querySelectorAll(".train")
        .forEach(card => {

            card.addEventListener(
                "click",
                () => {

                    card.classList.toggle(
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

    const selectedDate =
        dateInput.value;


    if (!selectedDate) {
        return;
    }


    try {

        const response =
            await fetch(
                `data/${selectedDate}.json?t=${Date.now()}`,
                {
                    cache: "no-store"
                }
            );


        if (!response.ok) {

            throw new Error(
                `HTTP ${response.status}`
            );
        }


        const data =
            await response.json();


        if (!Array.isArray(data.trains)) {

            throw new Error(
                "El JSON no conté l'array trains"
            );
        }


        trains =
            data.trains;


        console.log(
            `R15 Tracker: ${trains.length} trens carregats`
        );


        render();


    } catch (error) {

        console.error(
            "Error carregant dades:",
            error
        );


        trainsContainer.innerHTML = `

            <div class="empty">

                <div class="empty-title">
                    Error carregant les dades
                </div>

                <div class="empty-text">
                    No s'han pogut carregar les dades.
                </div>

            </div>
        `;
    }
}


// ============================================================
// EVENTS
// ============================================================

directionSelect.addEventListener(
    "change",
    render
);


dateInput.addEventListener(
    "change",
    () => {

        showHistory = false;

        loadData();

    }
);


historyButton.addEventListener(
    "click",
    () => {

        showHistory =
            !showHistory;

        render();

        window.scrollTo({
            top: 0,
            behavior: "smooth"
        });

    }
);


// ============================================================
// INIT
// ============================================================

dateInput.value =
    getTodayString();


loadData();


// Actualització cada minut.
setInterval(
    loadData,
    60 * 1000
);
