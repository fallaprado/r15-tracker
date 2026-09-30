let currentData = null;

const directionSelect = document.getElementById("direction");
const dateInput = document.getElementById("date");
const summary = document.getElementById("summary");
const trainsContainer = document.getElementById("trains");

function getTodayLocal() {
    const now = new Date();

    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");

    return year + "-" + month + "-" + day;
}

function minutesToTime(minutes) {
    if (minutes === null || minutes === undefined) {
        return "--:--";
    }

    let total = Number(minutes);

    if (Number.isNaN(total)) {
        return "--:--";
    }

    total = total % (24 * 60);

    if (total < 0) {
        total += 24 * 60;
    }

    const hours = Math.floor(total / 60);
    const mins = total % 60;

    return String(hours).padStart(2, "0") + ":" +
           String(mins).padStart(2, "0");
}

function formatDate(dateString) {
    const parts = dateString.split("-");

    if (parts.length !== 3) {
        return dateString;
    }

    return parts[2] + "/" + parts[1] + "/" + parts[0];
}

function getTrainStatus(train) {
    const now = new Date();

    const departure = train.departure
        ? new Date(train.departure)
        : null;

    const arrival = train.arrival
        ? new Date(train.arrival)
        : null;

    if (!departure || !arrival) {
        return "pending";
    }

    if (now < departure) {
        return "pending";
    }

    if (now >= departure && now <= arrival) {
        return "running";
    }

    return "finished";
}

async function loadData() {
    const selectedDate = dateInput.value;

    if (!selectedDate) {
        return;
    }

    trainsContainer.innerHTML =
        '<p class="loading">Carregant dades...</p>';

    try {
        const response = await fetch(
            "data/" + selectedDate + ".json?t=" + Date.now()
        );

        if (!response.ok) {
            throw new Error(
                "No s'ha trobat el fitxer de dades: " +
                selectedDate
            );
        }

        currentData = await response.json();

        render();

    } catch (error) {
        console.error(error);

        summary.innerHTML = "";

        trainsContainer.innerHTML =
            '<p class="empty">No hi ha dades disponibles per a aquest dia.</p>';
    }
}

function render() {
    if (!currentData) {
        return;
    }

    const selectedDirection = directionSelect.value;

    const trains = currentData.trains.filter(function(train) {
        return train.direction === selectedDirection;
    });

    trainsContainer.innerHTML = "";

    const dateText = formatDate(currentData.date);

    summary.innerHTML =
        "<strong>" +
        dateText +
        "</strong> · " +
        trains.length +
        " circulacions";

    if (trains.length === 0) {
        trainsContainer.innerHTML =
            '<p class="empty">No hi ha circulacions per a aquest sentit.</p>';

        return;
    }

    trains.forEach(function(train) {
        const element = createTrain(train);
        trainsContainer.appendChild(element);
    });
}

function createTrain(train) {
    const article = document.createElement("article");

    const status = getTrainStatus(train);

    article.className = "train " + status;

    const firstStop =
        train.stops && train.stops.length > 0
            ? train.stops[0]
            : null;

    const lastStop =
        train.stops && train.stops.length > 0
            ? train.stops[train.stops.length - 1]
            : null;

    const departureTime = firstStop
        ? minutesToTime(
            firstStop.scheduled_departure ??
            firstStop.scheduled_arrival
        )
        : "--:--";

    const arrivalTime = lastStop
        ? minutesToTime(
            lastStop.scheduled_arrival ??
            lastStop.scheduled_departure
        )
        : "--:--";

    let statusText = "";

    if (status === "pending") {
        statusText = "Pendent";
    }

    if (status === "running") {
        statusText =
            '<span class="live-dot"></span> En circulació';
    }

    if (status === "finished") {
        statusText = "Finalitzat";
    }

    const trainHeader = document.createElement("div");

    trainHeader.className = "train-header";

    trainHeader.innerHTML =
        '<div class="train-number">' +
        '<strong>R15</strong>' +
        '<span>' +
        escapeHtml(train.train_id) +
        "</span>" +
        "</div>" +

        '<div class="train-route">' +
        '<span>' +
        departureTime +
        "</span>" +
        '<span class="arrow">→</span>' +
        '<span>' +
        arrivalTime +
        "</span>" +
        "</div>" +

        '<div class="train-status">' +
        statusText +
        "</div>";

    article.appendChild(trainHeader);

    const stopsContainer = createStops(train);

    article.appendChild(stopsContainer);

    trainHeader.addEventListener("click", function() {
        article.classList.toggle("expanded");
    });

    return article;
}

function createStops(train) {
    const container = document.createElement("div");

    container.className = "stops";

    const stops = train.stops || [];

    stops.forEach(function(stop) {
        const row = document.createElement("div");

        row.className = "stop";

        const scheduled = stop.scheduled_arrival ??
                          stop.scheduled_departure;

        const actual = stop.actual_minutes;

        let actualHtml = "";

        if (actual !== null && actual !== undefined) {
            actualHtml =
                '<span class="actual">' +
                minutesToTime(actual) +
                "</span>";
        } else {
            actualHtml =
                '<span class="actual pending-time">--:--</span>';
        }

        let delayHtml = "";

        if (
            stop.delay_minutes !== null &&
            stop.delay_minutes !== undefined &&
            Number(stop.delay_minutes) !== 0
        ) {
            const delay = Number(stop.delay_minutes);

            const sign = delay > 0 ? "+" : "";

            delayHtml =
                '<span class="delay">' +
                sign +
                delay +
                " min</span>";
        }

        row.innerHTML =
            '<div class="stop-station">' +
            escapeHtml(stop.station || "") +
            "</div>" +

            '<div class="stop-times">' +
            '<span class="scheduled">' +
            minutesToTime(scheduled) +
            "</span>" +

            actualHtml +

            delayHtml +
            "</div>";

        container.appendChild(row);
    });

    const finalDelay = Number(train.final_delay_minutes || 0);

    if (finalDelay > 15) {
        const refund = document.createElement("div");

        refund.className = "refund-message";

        refund.textContent =
            "Sí es pot sol·licitar devolució express";

        container.appendChild(refund);
    }

    return container;
}

function escapeHtml(text) {
    const div = document.createElement("div");

    div.textContent = text;

    return div.innerHTML;
}

directionSelect.addEventListener("change", function() {
    render();
});

dateInput.addEventListener("change", function() {
    loadData();
});

dateInput.value = getTodayLocal();

loadData();

setInterval(function() {
    loadData();
}, 60000);
