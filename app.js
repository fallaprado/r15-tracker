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
// MINUTS → HH:MM
// ============================================================

function minutesToTime(minutes) {

    if (minutes === null || minutes === undefined) {
        return "--:--";
    }

    const totalMinutes = Math.round(minutes);

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

    if (latestDelay !== null) {
        return latestDelay;
    }

    if (
        train.realtime_trip_delay_minutes !== null &&
        train.realtime_trip_delay_minutes !== undefined
    ) {
        return train.realtime_trip_delay_minutes;
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
// warning  → està circulant amb 4-15 min de retard
// late     → retard superior a 15 min
// finished  → ja ha arribat
//
// PRIORITAT:
// 1. >15 min → vermell
// 2. encara no ha sortit → gris
// 3. ja ha arribat → gris
// 4. circulant 4-15 min → taronja
// 5. circulant <4 min → verd
// ============================================================

function getTrainStatus(train) {

    const now = new Date();

    const currentDelay = getCurrentTrainDelay(train);
    const finalDelay = getFinalDelay(train);

    // --------------------------------------------------------
    // RETARD SUPERIOR A 15 MINUTS
    // --------------------------------------------------------

    if (
        currentDelay > 15 ||
        (finalDelay !== null && finalDelay > 15)
    ) {
        return "late";
    }


    // --------------------------------------------------------
    // HORARI DE SORTIDA
    // --------------------------------------------------------

    const departureTime = train.departure_minutes;

    if (
        departureTime !== null &&
        departureTime !== undefined
    ) {

        const currentMinutes =
            now.getHours() * 60 +
            now.getMinutes();

        if (currentMinutes < departureTime) {
            return "pending";
        }
    }


    // --------------------------------------------------------
    // HORARI D'ARRIBADA
    // --------------------------------------------------------

    const arrivalTime = train.arrival_minutes;

    if (
        arrivalTime !== null &&
        arrivalTime !== undefined
    ) {

        const currentMinutes =
            now.getHours() * 60 +
            now.getMinutes();

        const arrivalWithDelay =
            arrivalTime + Math.max(currentDelay, 0);

        if (currentMinutes >= arrivalWithDelay) {
            return "finished";
        }
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
            (a.departure_minutes || 0) -
            (b.departure_minutes || 0)
        );

    });


    // --------------------------------------------------------
    // FILTRAR TRENS JA ARRIBATS
    // --------------------------------------------------------
    //
    // Per defecte:
    // només mostrem els que encara no han arribat.
    //
    // Si showHistory = true:
    // mostrem tots els trens del dia.
    //
    // IMPORTANT:
    // Els trens amb retard >15 min que ja han arribat
    // només apareixeran quan s'activi l'històric.
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

    const totalTrains = data.trains
        ? data.trains.filter(
            train => train.direction === direction
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
                ${totalTrains} circulacions previstes avui
            </div>
        `;
    }


    // ========================================================
    // SI NO HI HA TRENS
    // ========================================================

    if (trains.length === 0) {

        if (showHistory) {

            trainsContainer.innerHTML = `
                <p class="empty">
                    No hi ha trens registrats per a aquest sentit.
                </p>
            `;

        } else {

            trainsContainer.innerHTML = `
                <div class="empty">
                    <p>No hi ha cap tren pendent o en circulació.</p>

                    <button
                        class="history-button"
                        onclick="enableHistory()"
                    >
                        Consultar trens ja arribats
                    </button>
                </div>
            `;
        }

        return;
    }


    // ========================================================
    // CREAR TARGETES
    // ========================================================

    trainsContainer.innerHTML = "";

    trains.forEach(train => {

        const element = createTrain(train);

        trainsContainer.appendChild(element);

    });
}


// ============================================================
// CREAR TREN
// ============================================================

function createTrain(train) {

    const status = getTrainStatus(train);

    const currentDelay = getCurrentTrainDelay(train);
    const finalDelay = getFinalDelay(train);

    const article = document.createElement("article");

    article.className = `train ${status}`;


    // ========================================================
    // CAPÇALERA
    // ========================================================

    const header = document.createElement("div");

    header.className = "train-header";


    // --------------------------------------------------------
    // INFORMACIÓ PRINCIPAL
    // --------------------------------------------------------

    const mainInfo = document.createElement("div");

    mainInfo.className = "train-main";


    const trainNumber = document.createElement("div");

    trainNumber.className = "train-number";

    trainNumber.textContent =
        train.train_number || train.trip_id || "R15";


    const route = document.createElement("div");

    route.className = "train-route";

    route.textContent =
        `${train.origin} → ${train.destination}`;


    mainInfo.appendChild(trainNumber);
    mainInfo.appendChild(route);


    // ========================================================
    // HORARIS
    // ========================================================

    const times = document.createElement("div");

    times.className = "train-times";


    const departure = document.createElement("div");

    departure.innerHTML = `
        <span class="time-label">Sortida</span>
        <strong>${minutesToTime(train.departure_minutes)}</strong>
    `;


    const arrival = document.createElement("div");

    arrival.innerHTML = `
        <span class="time-label">Arribada</span>
        <strong>${minutesToTime(train.arrival_minutes)}</strong>
    `;


    times.appendChild(departure);
    times.appendChild(arrival);


    // ========================================================
    // ESTAT
    // ========================================================

    const statusElement = document.createElement("div");

    statusElement.className = "train-status";


    // Punt animat només quan està circulant.
    if (
        status === "running" ||
        status === "warning" ||
        status === "late"
    ) {

        const liveDot = document.createElement("span");

        liveDot.className = "live-dot";

        statusElement.appendChild(liveDot);
    }


    const statusText = document.createElement("span");

    statusText.textContent =
        getStatusText(status);

    statusElement.appendChild(statusText);


    // ========================================================
    // RETARD
    // ========================================================

    if (status === "running" || status === "warning") {

        if (currentDelay > 0) {

            const delay = document.createElement("span");

            delay.className = "delay";

            delay.textContent =
                `+${currentDelay} min`;

            statusElement.appendChild(delay);
        }

    } else if (
        status === "late" &&
        finalDelay !== null
    ) {

        const delay = document.createElement("span");

        delay.className = "delay";

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
    // FLETXA / CLICK
    // ========================================================

    const arrow = document.createElement("span");

    arrow.className = "train-arrow";

    arrow.textContent = "›";

    header.appendChild(arrow);


    // ========================================================
    // PARADES
    // ========================================================

    const stopsContainer = document.createElement("div");

    stopsContainer.className = "stops";


    if (train.stops && train.stops.length > 0) {

        train.stops.forEach(stop => {

            const stopElement =
                document.createElement("div");

            stopElement.className = "stop";


            // ------------------------------------------------
            // NOM
            // ------------------------------------------------

            const stopName =
                document.createElement("div");

            stopName.className = "stop-name";

            stopName.textContent =
                stop.stop_name || stop.name || "";


            // ------------------------------------------------
            // HORARI
            // ------------------------------------------------

            const stopTimes =
                document.createElement("div");

            stopTimes.className = "stop-times";


            const scheduled =
                document.createElement("span");

            scheduled.className =
                "stop-scheduled";

            scheduled.textContent =
                minutesToTime(stop.scheduled_minutes);


            const actual =
                document.createElement("span");

            actual.className =
                "stop-actual";


            if (
                stop.actual_time !== null &&
                stop.actual_time !== undefined
            ) {

                actual.textContent =
                    stop.actual_time;

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

            stopsContainer.appendChild(stopElement);

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

        stopsContainer.appendChild(refund);
    }


    // ========================================================
    // CLICK PER EXPANDIR
    // ========================================================

    header.addEventListener("click", () => {

        article.classList.toggle("expanded");

    });


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
// ACTUALITZAR TEXT DEL BOTÓ
// ============================================================

function updateHistoryButton() {

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
        // tornem a la vista normal.
        showHistory = false;

        updateHistoryButton();

        loadData();

    }
);


// ============================================================
// INICIALITZACIÓ
// ============================================================

dateInput.value = getTodayLocal();

updateHistoryButton();

loadData();


// ============================================================
// ACTUALITZACIÓ AUTOMÀTICA
// ============================================================
//
// Cada minut tornem a carregar les dades.
// Això permet que un tren pendent passi a
// "en circulació" sense haver de refrescar la pàgina.
// ============================================================

setInterval(
    () => {

        loadData();

    },
    60 * 1000
);
