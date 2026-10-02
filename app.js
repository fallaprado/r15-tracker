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
// TIME HELPERS
// ============================================================

function parseTimeToMinutes(value) {

    if (!value) {
        return null;
    }

    // ISO: 2026-10-01T15:34:00
    if (typeof value === "string" && value.includes("T")) {

        const time = value.substring(11, 16);

        const parts = time.split(":");

        if (parts.length === 2) {
            return Number(parts[0]) * 60 + Number(parts[1]);
        }
    }

    // HH:MM
    if (typeof value === "string" && /^\d{1,2}:\d{2}$/.test(value)) {

        const parts = value.split(":");

        return Number(parts[0]) * 60 + Number(parts[1]);
    }

    return null;
}


function getNowMinutes() {

    const now = new Date();

    return now.getHours() * 60 + now.getMinutes();
}


function getDelayMinutes(train) {

    const candidates = [
        train.realtime_trip_delay_minutes,
        train.final_delay_minutes,
        train.delay_minutes
    ];

    for (const value of candidates) {

        if (value !== undefined && value !== null && value !== "") {

            const number = Number(value);

            if (!Number.isNaN(number)) {
                return number;
            }
        }
    }

    return 0;
}


// ============================================================
// DEPARTURE / ARRIVAL
// ============================================================

function getDepartureTime(train) {

    return (
        train.departure ||
        train.departure_time ||
        train.first_departure ||
        null
    );
}


function getArrivalTime(train) {

    return (
        train.arrival ||
        train.arrival_time ||
        train.final_arrival ||
        null
    );
}


// ============================================================
// ARRIVAL DETECTION
// ============================================================

function isExplicitlyArrived(train) {

    if (
        train.arrived === true ||
        train.arrived === "true" ||
        train.arrived === 1 ||
        train.arrived === "1"
    ) {
        return true;
    }

    return false;
}


function getLastStop(train) {

    if (!Array.isArray(train.stops) || train.stops.length === 0) {
        return null;
    }

    return train.stops[train.stops.length - 1];
}


function getActualArrivalMinutes(train) {

    const lastStop = getLastStop(train);

    if (!lastStop) {
        return null;
    }

    const possibleTimes = [
        lastStop.actual_time,
        lastStop.realtime_time,
        lastStop.arrival_actual,
        lastStop.arrival_time_actual
    ];

    for (const value of possibleTimes) {

        const minutes = parseTimeToMinutes(value);

        if (minutes !== null) {
            return minutes;
        }
    }

    return null;
}


function hasTrainArrived(train, selectedDate) {

    // Si el collector ho diu explícitament,
    // ens ho creiem.
    if (isExplicitlyArrived(train)) {
        return true;
    }

    const today = getTodayString();

    // Un dia anterior a avui:
    // tots els trens ja han acabat.
    if (selectedDate < today) {
        return true;
    }

    // Un dia posterior:
    // evidentment encara no ha arribat cap tren.
    if (selectedDate > today) {
        return false;
    }

    // Avui: primer mirem si tenim hora REAL
    // de l'última parada.
    const actualArrival = getActualArrivalMinutes(train);

    if (actualArrival !== null) {
        return actualArrival <= getNowMinutes();
    }

    // Si el tren té una hora d'arribada teòrica però
    // encara no tenim una hora real, no el traiem
    // prematurament de la pantalla.
    return false;
}


// ============================================================
// DEPARTED
// ============================================================

function hasTrainDeparted(train, selectedDate) {

    const today = getTodayString();

    if (selectedDate < today) {
        return true;
    }

    if (selectedDate > today) {
        return false;
    }

    if (train.started === true || train.started === "true") {
        return true;
    }

    const departureMinutes = parseTimeToMinutes(
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

    const arrived = hasTrainArrived(train, selectedDate);
    const departed = hasTrainDeparted(train, selectedDate);

    // IMPORTANT:
    // El retard >15 té prioritat, fins i tot
    // si el tren ja ha arribat.
    if (delay > 15) {
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

    // Està circulant.

    if (delay >= 4) {
        return "warning";
    }

    return "running";
}


// ============================================================
// LABELS
// ============================================================

function getStatusText(status, delay) {

    switch (status) {

        case "pending":
            return "Encara no ha sortit";

        case "running":

            if (delay <= 0) {
                return "🟢 Circulant · puntual";
            }

            return `🟢 Circulant · +${delay} min`;

        case "warning":
            return `🟠 Circulant · +${delay} min`;

        case "late":
            return `🔴 Retard · +${delay} min`;

        case "finished":

            if (delay > 15) {
                return `🔴 Arribat · +${delay} min`;
            }

            return "⚪ Arribat";

        default:
            return "";
    }
}


// ============================================================
// FORMAT
// ============================================================

function formatTime(value) {

    if (!value) {
        return "--:--";
    }

    if (typeof value === "string" && value.includes("T")) {
        return value.substring(11, 16);
    }

    if (
        typeof value === "string" &&
        /^\d{1,2}:\d{2}/.test(value)
    ) {
        return value.substring(0, 5);
    }

    return "--:--";
}


function getTrainId(train) {

    return (
        train.train_id ||
        train.trip_id ||
        train.id ||
        "Tren"
    );
}


// ============================================================
// STOPS
// ============================================================

function renderStops(train) {

    if (!Array.isArray(train.stops) || train.stops.length === 0) {

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
    `;

    for (const stop of train.stops) {

        const station =
            stop.stop_name ||
            stop.station_name ||
            stop.name ||
            stop.stop ||
            "Parada";

        const theoretical =
            stop.arrival ||
            stop.departure ||
            stop.arrival_time ||
            stop.departure_time ||
            stop.time ||
            null;

        const actual =
            stop.actual_time ||
            stop.realtime_time ||
            null;

        let actualHtml = "";

        if (actual) {

            actualHtml = `
                <span class="actual-time">
                    ${formatTime(actual)}
                </span>
            `;

        } else if (stop.realtime_event) {

            actualHtml = `
                <span class="estimated-time">
                    ${formatTime(stop.realtime_event)}
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

                    ${actualHtml}

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

    const status = getTrainStatus(train, selectedDate);

    const delay = getDelayMinutes(train);

    const departure = getDepartureTime(train);
    const arrival = getArrivalTime(train);

    const trainId = getTrainId(train);

    const statusText = getStatusText(status, delay);

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

                        <span class="arrow">→</span>

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

    const selectedDate = dateInput.value;

    if (!selectedDate) {
        trainsContainer.innerHTML = "";
        return;
    }

    const direction = directionSelect.value;

    let filtered = trains.filter(train => {

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


    const processed = filtered.map(train => ({
        train,
        status: getTrainStatus(train, selectedDate)
    }));


    // Vista normal:
    // només pendents + circulant.
    //
    // Històric:
    // només els que ja han arribat.
    if (!showHistory) {

        filtered = processed
            .filter(item =>
                item.status !== "finished"
            )
            .map(item => item.train);

    } else {

        filtered = processed
            .filter(item =>
                item.status === "finished" ||
                getDelayMinutes(item.train) > 15
            )
            .map(item => item.train);
    }


    // Ordenem per hora de sortida.
    filtered.sort((a, b) => {

        const timeA = parseTimeToMinutes(
            getDepartureTime(a)
        );

        const timeB = parseTimeToMinutes(
            getDepartureTime(b)
        );

        if (timeA === null) return 1;
        if (timeB === null) return -1;

        return timeA - timeB;
    });


    // Resum
    const normalCount = processed.filter(
        item => item.status !== "finished"
    ).length;

    const finishedCount = processed.filter(
        item => item.status === "finished"
    ).length;


    summaryContainer.innerHTML = `
        <div class="summary-box">

            <span>
                ${showHistory
                    ? `${filtered.length} trens arribats`
                    : `${normalCount} trens pendents o en circulació`}
            </span>

            <span>
                ${finishedCount} arribats
            </span>

        </div>
    `;


    // Botó
    historyButton.textContent = showHistory
        ? "← Tornar als trens actuals"
        : "Consultar trens ja arribats";


    // No results
    if (filtered.length === 0) {

        trainsContainer.innerHTML = `
            <div class="empty">

                <div class="empty-title">
                    ${showHistory
                        ? "No hi ha trens arribats"
                        : "No hi ha trens pendents o en circulació"}
                </div>

                <div class="empty-text">
                    ${showHistory
                        ? "No s'han trobat circulacions finalitzades."
                        : "Tots els trens d'aquest sentit ja han arribat o encara no hi ha circulacions."}
                </div>

            </div>
        `;

        return;
    }


    trainsContainer.innerHTML = filtered
        .map(train =>
            renderTrain(train, selectedDate)
        )
        .join("");


    // Expandir / contraure
    document
        .querySelectorAll(".train")
        .forEach(card => {

            card.addEventListener("click", () => {

                card.classList.toggle("expanded");

            });

        });
}


// ============================================================
// LOAD DATA
// ============================================================

async function loadData() {

    const selectedDate = dateInput.value;

    if (!selectedDate) {
        return;
    }

    trainsContainer.innerHTML = `
        <p class="loading">
            Carregant dades...
        </p>
    `;


    try {

        const response = await fetch(
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


        const data = await response.json();


        if (!Array.isArray(data.trains)) {

            throw new Error(
                "El JSON no conté l'array trains"
            );
        }


        trains = data.trains;


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
                    No s'han pogut carregar els trens d'aquest dia.
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

        showHistory = !showHistory;

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

dateInput.value = getTodayString();

loadData();


// Actualitzar cada minut.
// El collector continua actualitzant el JSON
// cada 5 minuts.
setInterval(
    loadData,
    60 * 1000
);
