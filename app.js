let currentData = null;

const direction = document.getElementById("direction");
const date = document.getElementById("date");
const trains = document.getElementById("trains");
const summary = document.getElementById("summary");

const today = new Date().toISOString().split("T")[0];

date.value = today;

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
            <p>
                No hi ha dades disponibles
                per aquest dia.
            </p>
        `;

        summary.innerHTML = "";
    }
}

function render() {

    const selectedDirection = direction.value;

    const selectedTrains =
        currentData.trains.filter(
            train =>
                train.direction === selectedDirection
        );

    summary.innerHTML = `
        <strong>
            ${selectedTrains.length}
            circulacions
        </strong>
    `;

    trains.innerHTML = "";

    selectedTrains.forEach(train => {

        const element = createTrain(train);

        trains.appendChild(element);

    });
}

function createTrain(train) {

    const container =
        document.createElement("div");

    const now = new Date();

    const departure =
        new Date(train.departure);

    let status = "pending";

    if (train.arrived) {

        status = "finished";

    } else if (
        train.started ||
        departure <= now
    ) {

        status = "running";

    }

    if (
        train.final_delay_minutes > 15
    ) {

        status = "refund";

    }

    container.className =
        `train ${status}`;

    let statusText;

    if (status === "pending") {

        statusText =
            "Encara no ha sortit";

    } else if (status === "running") {

        statusText =
            `<span class="live-dot"></span>
             En circulació`;

    } else if (status === "finished") {

        statusText =
            "✓ Finalitzat";

    } else {

        statusText =
            "⚠ Retard";

    }

    container.innerHTML = `

        <div class="train-header">

            <div>

                <div class="train-number">
                    R15 · ${train.train_id}
                </div>

                <div>
                    ${formatTime(train.departure)}
                    →
                    ${formatTime(train.arrival)}
                </div>

            </div>

            <div class="status">
                ${statusText}
            </div>

        </div>

        <div class="stops">

            ${createStops(train)}

        </div>

    `;

    container
        .querySelector(".train-header")
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

function createStops(train) {

    let html = `

        <div class="stop">

            <strong>Estació</strong>
            <strong>Teòrica</strong>
            <strong>Real</strong>
            <strong>Retard</strong>

        </div>

    `;

    train.stops.forEach(stop => {

        const delay =
            stop.actual_minutes === null
                ? null
                :
                stop.actual_minutes -
                stop.scheduled_minutes;

        html += `

            <div class="stop">

                <span>
                    ${stop.station}
                </span>

                <span>
                    ${minutesToTime(
                        stop.scheduled_minutes
                    )}
                </span>

                <span>
                    ${
                        stop.actual_minutes === null
                        ?
                        "—"
                        :
                        minutesToTime(
                            stop.actual_minutes
                        )
                    }
                </span>

                <span
                    class="
                        delay
                        ${
                            delay !== null &&
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
                        `${delay > 0 ? "+" : ""}${delay}'`
                    }
                </span>

            </div>

        `;

    });

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

function formatTime(value) {

    return new Date(value)
        .toLocaleTimeString(
            "ca-ES",
            {
                hour: "2-digit",
                minute: "2-digit"
            }
        );
}

function minutesToTime(minutes) {

    const h =
        Math.floor(
            minutes / 60
        ) % 24;

    const m =
        minutes % 60;

    return String(h)
        .padStart(2, "0")
        + ":" +
        String(m)
        .padStart(2, "0");
}

direction.addEventListener(
    "change",
    render
);

date.addEventListener(
    "change",
    loadData
);

setInterval(
    loadData,
    60000
);

loadData();
