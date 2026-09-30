let currentData = null;

const direction = document.getElementById("direction");
const date = document.getElementById("date");
const trains = document.getElementById("trains");
const summary = document.getElementById("summary");


/* ============================================================
   DATA LOCAL
   ============================================================ */

function getTodayLocal() {

    const now = new Date();

    const year = now.getFullYear();

    const month = String(
        now.getMonth() + 1
    ).padStart(2, "0");

    const day = String(
        now.getDate()
    ).padStart(2, "0");

    return `${year}-${month}-${day}`;
}


date.value = getTodayLocal();


/* ============================================================
   CARREGAR DADES
   ============================================================ */

async function loadData() {

    trains.innerHTML = `
        <p class="loading">
            Carregant dades...
        </p>
    `;

    try {

        const response = await fetch(
            `data/${date.value}.json?t=${Date.now()}`
        );


        if (!response.ok) {

            throw new Error(
                "No existeixen dades per aquest dia"
            );

        }


        currentData = await response.json();

        render();


    } catch (error) {

        trains.innerHTML = `
            <div class="empty">
                <strong>
                    No hi ha dades disponibles
                </strong>

                <p>
                    No s'han trobat dades per al
                    ${formatDate(date.value)}.
                </p>
            </div>
        `;

        summary.innerHTML = "";
    }
}


/* ============================================================
   RENDER PRINCIPAL
   ============================================================ */

function render() {

    if (!currentData) {
        return;
    }


    const selectedDirection =
        direction.value;


    const selectedTrains =
        currentData.trains
            .filter(
                train =>
                    train.direction ===
                    selectedDirection
            )
            .sort(
                (a, b) =>
                    new Date(a.departure)
                    -
                    new Date(b.departure)
            );


    const directionName =
        selectedDirection === "REUS_BAR"
            ? "Reus → Barcelona"
            : "Barcelona → Reus";


    summary.innerHTML = `
        <div class="summary-card">

            <strong>
                ${selectedTrains.length}
                circulacions
            </strong>

            <span>
                ${directionName}
            </span>

        </div>
    `;


    trains.innerHTML = "";


    if (selectedTrains.length === 0) {

        trains.innerHTML = `
            <div class="empty">
                No hi ha circulacions
                per aquest sentit.
            </div>
        `;

        return;
    }


    selectedTrains.forEach(
        train => {

            const element =
                createTrain(train);

            trains.appendChild(element);

        }
    );
}


/* ============================================================
   CREAR TREN
   ============================================================ */

function createTrain(train) {

    const container =
        document.createElement("div");


    const now =
        new Date();


    const departure =
        new Date(train.departure);


    const arrival =
        new Date(train.arrival);


    let status = "pending";


    /*
     * Un tren amb retard final superior
     * a 15 minuts té prioritat visual.
     */

    if (
        train.final_delay_minutes > 15
        &&
        arrival <= now
    ) {

        status = "refund";

    }

    else if (
        arrival <= now
    ) {

        status = "finished";

    }

    else if (
        departure <= now
        ||
        train.started
    ) {

        status = "running";

    }


    container.className =
        `train ${status}`;


    /* ========================================================
       TEXT ESTAT
       ======================================================== */

    let statusText;


    if (status === "pending") {

        statusText =
            "Encara no ha sortit";

    }

    else if (status === "running") {

        statusText = `
            <span class="live-dot"></span>
            En circulació
        `;

    }

    else if (status === "finished") {

        statusText =
            "✓ Finalitzat";

    }

    else {

        statusText =
            "⚠ Retard >15 min";

    }


    /* ========================================================
       RETARD
       ======================================================== */

    let delayText = "";


    if (
        train.final_delay_minutes
        &&
        train.final_delay_minutes > 0
    ) {

        delayText = `
            <span class="train-delay">
                +${train.final_delay_minutes}'
            </span>
        `;

    }


    /* ========================================================
       HTML
       ======================================================== */

    container.innerHTML = `

        <div class="train-header">

            <div class="train-main">

                <div class="train-number">

                    R15 · ${train.train_id}

                </div>


                <div class="train-route">

                    <strong>
                        ${formatTime(
                            train.departure
                        )}
                    </strong>

                    <span>→</span>

                    <strong>
                        ${formatTime(
                            train.arrival
                        )}
                    </strong>

                </div>

            </div>


            <div class="train-status">

                ${statusText}

                ${delayText}

            </div>

        </div>


        <div class="stops">

            ${createStops(train)}

        </div>

    `;


    container
        .querySelector(
            ".train-header"
        )
        .addEventListener(
            "click",
            () => {

                container.classList.toggle(
                    "open"
                );

            }
        );


    return container;
}


/* ============================================================
   PARADES
   ============================================================ */

function createStops(train) {

    let html = `

        <div class="stop stop-header">

            <strong>
                Estació
            </strong>

            <strong>
                Teòrica
            </strong>

            <strong>
                Real
            </strong>

            <strong>
                Retard
            </strong>

        </div>

    `;


    train.stops.forEach(
        stop => {

            const scheduled =
                stop.scheduled_arrival
                ??
                stop.scheduled_departure;


            const actual =
                stop.actual_minutes;


            let delay = null;


            if (
                actual !== null &&
                actual !== undefined &&
                scheduled !== null &&
                scheduled !== undefined
            ) {

                delay =
                    actual -
                    scheduled;

            }


            html += `

                <div class="stop">

                    <span>
                        ${stop.station}
                    </span>

                    <span>
                        ${
                            scheduled !== null
                            &&
                            scheduled !== undefined
                                ?
                            minutesToTime(
                                scheduled
                            )
                                :
                            "—"
                        }
                    </span>

                    <span
                        class="${
                            actual !== null
                            &&
                            actual !== undefined
                                ?
                            "actual"
                                :
                            ""
                        }"
                    >
                        ${
                            actual !== null
                            &&
                            actual !== undefined
                                ?
                            minutesToTime(
                                actual
                            )
                                :
                            "—"
                        }
                    </span>

                    <span
                        class="
                            delay
                            ${
                                delay !== null
                                &&
                                delay > 0
                                    ?
                                "late"
                                    :
                                ""
                            }
                        "
                    >
                        ${
                            delay === null
                                ?
                            "—"
                                :
                            delay > 0
                                ?
                            `+${delay}'`
                                :
                            delay < 0
                                ?
                            `${delay}'`
                                :
                            "0'"
                        }
                    </span>

                </div>

            `;

        }
    );


    /* ========================================================
       DEVOLUCIÓ EXPRESS
       ======================================================== */

    if (
        train.final_delay_minutes > 15
    ) {

        html += `

            <div class="refund-message">

                🔴 Sí es pot sol·licitar
                devolució express

            </div>

        `;

    }


    return html;
}


/* ============================================================
   FORMATEJAR HORA
   ============================================================ */

function formatTime(value) {

    if (!value) {
        return "—";
    }


    return new Date(value)
        .toLocaleTimeString(
            "ca-ES",
            {
                hour: "2-digit",
                minute: "2-digit"
            }
        );
}


/* ============================================================
   MINUTS → HH:MM
   ============================================================ */

function minutesToTime(minutes) {

    if (
        minutes === null ||
        minutes === undefined
    ) {

        return "—";

    }


    const total =
        ((minutes % 1440) + 1440)
        % 1440;


    const h =
        Math.floor(
            total / 60
        );


    const m =
        total % 60;


    return (
        String(h).padStart(2, "0")
        +
        ":"
        +
        String(m).padStart(2, "0")
    );
}


/* ============================================================
   DATA → TEXT
   ============================================================ */

function formatDate(value) {

    if (!value) {
        return "";
    }


    const parts =
        value.split("-");


    if (parts.length !== 3) {
        return value;
    }


    return (
        parts[2]
        +
        "/"
        +
        parts[1]
        +
        "/"
        +
        parts[0]
    );
}


/* ============================================================
   EVENTS
   ============================================================ */

direction.addEventListener(
    "change",
    render
);


date.addEventListener(
    "change",
    loadData
);


/*
 * Actualitzar la pantalla cada minut.
 */

setInterval(
    loadData,
    60000
);


/* ============================================================
   INICI
   ============================================================ */

loadData();

