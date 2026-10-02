document.addEventListener("DOMContentLoaded", () => {
    let currentData = null;
    let activeDirection = "BAR_REUS";
    let selectedDate = getTodayString();
    let selectedTrainId = null;
    let showHistory = false;

    const navBarReus = document.getElementById("navBarReus");
    const navReusBar = document.getElementById("navReusBar");
    const dateInput = document.getElementById("dateInput");
    const trainsList = document.getElementById("trainsList");
    const emptyState = document.getElementById("emptyState");
    const toggleHistoryBtn = document.getElementById("toggleHistoryBtn");

    if (dateInput) {
        dateInput.value = selectedDate;
    }

    if (navBarReus) {
        navBarReus.addEventListener("click", () => {
            activeDirection = "BAR_REUS";
            updateDirectionNav();
            render();
        });
    }

    if (navReusBar) {
        navReusBar.addEventListener("click", () => {
            activeDirection = "REUS_BAR";
            updateDirectionNav();
            render();
        });
    }

    if (dateInput) {
        dateInput.addEventListener("change", (e) => {
            selectedDate = e.target.value || getTodayString();
            loadDataForDate(selectedDate);
        });
    }

    if (toggleHistoryBtn) {
        toggleHistoryBtn.addEventListener("click", () => {
            showHistory = !showHistory;
            updateHistoryButton();
            render();
        });
    }

    loadDataForDate(selectedDate);

    function updateDirectionNav() {
        if (navBarReus) {
            navBarReus.classList.toggle("active", activeDirection === "BAR_REUS");
        }
        if (navReusBar) {
            navReusBar.classList.toggle("active", activeDirection === "REUS_BAR");
        }
    }

    function updateHistoryButton() {
        if (!toggleHistoryBtn) return;
        if (showHistory) {
            toggleHistoryBtn.textContent = "Mostrant tots / historial (Fes clic per amagar)";
            toggleHistoryBtn.classList.add("active");
        } else {
            toggleHistoryBtn.textContent = "Consultar trens ja arribats";
            toggleHistoryBtn.classList.remove("active");
        }
    }

    async function loadDataForDate(dateStr) {
        showLoading();
        try {
            const res = await fetch(`data/${dateStr}.json?cache=${Date.now()}`);
            if (!res.ok) {
                throw new Error("Dades no trobades");
            }
            currentData = await res.json();
            render();
        } catch (err) {
            currentData = null;
            renderEmpty("No hi ha dades disponibles per a aquesta data.");
        }
    }

    function render() {
        if (!trainsList) return;
        trainsList.innerHTML = "";

        if (!currentData || !Array.isArray(currentData.trains)) {
            renderEmpty("No s'han pogut carregar les circulacions.");
            return;
        }

        const trains = currentData.trains.filter(t => t.direction === activeDirection);

        let visible = [];
        if (!showHistory) {
            visible = trains.filter(train => !hasTrainArrived(train, selectedDate));
        } else {
            visible = trains;
        }

        if (visible.length === 0) {
            renderEmpty(
                showHistory
                    ? "No hi ha cap circulació registrada per a aquesta direcció."
                    : "No hi ha més trens hores d'ara. Prem 'Consultar trens ja arribats' per veure l'historial del dia."
            );
            return;
        }

        hideEmptyState();

        visible.forEach((train) => {
            const card = createTrainCard(train);
            trainsList.appendChild(card);
        });
    }

    function createTrainCard(train) {
        const card = document.createElement("div");
        card.className = "train-card";

        const depTime = getDepartureTime(train);
        const arrTime = getArrivalTime(train);

        const stops = Array.isArray(train.stops) ? train.stops : [];
        const originName = stops.length > 0 ? stops[0].station : "Origen";
        const destName = stops.length > 0 ? stops[stops.length - 1].station : "Destí";

        const delay = getTrainDelay(train);
        let badgeHtml = "";

        if (train.started || delay > 0) {
            if (delay > 0) {
                badgeHtml = `<span class="badge delay">+${delay} min</span>`;
            } else {
                badgeHtml = `<span class="badge on-time">A l'hora</span>`;
            }
        } else {
            badgeHtml = `<span class="badge scheduled">Programat</span>`;
        }

        const isExpanded = selectedTrainId === train.train_id;

        card.innerHTML = `
            <div class="train-header">
                <div class="train-time-group">
                    <div class="train-times">
                        <span class="dep-time">${formatTime(depTime)}</span>
                        <span class="arrow">➔</span>
                        <span class="arr-time">${formatTime(arrTime)}</span>
                    </div>
                    <div class="train-stations">
                        ${originName} ➔ ${destName}
                    </div>
                </div>
                <div class="train-status">
                    ${badgeHtml}
                    <span class="expand-icon">${isExpanded ? "▲" : "▼"}</span>
                </div>
            </div>
            <div class="train-details ${isExpanded ? "open" : ""}">
                ${isExpanded ? renderStopsHtml(train) : ""}
            </div>
        `;

        const header = card.querySelector(".train-header");
        header.addEventListener("click", () => {
            selectedTrainId = selectedTrainId === train.train_id ? null : train.train_id;
            render();
        });

        return card;
    }

    function renderStopsHtml(train) {
        if (!Array.isArray(train.stops) || train.stops.length === 0) {
            return `<div class="p-3 text-center">No hi ha detall de parades disponible.</div>`;
        }

        let html = `<div class="stops-timeline">`;

        train.stops.forEach((stop) => {
            const station = stop.station || "Estació";
            const theo = stop.scheduled_departure || stop.scheduled_arrival;
            const real = stop.actual_minutes;
            const delay = stop.delay_minutes;

            let timeRealHtml = "";

            if (real !== undefined && real !== null) {
                timeRealHtml = `
                    <div class="real-time-val text-success font-weight-bold">
                        ${formatTime(real)} <small>(real)</small>
                    </div>
                `;
            } else if (theo !== null && delay !== null && delay !== undefined) {
                const est = theo + delay;
                timeRealHtml = `
                    <div class="real-time-val text-warning">
                        ${formatTime(est)} <small>(est.)</small>
                    </div>
                `;
            } else {
                timeRealHtml = `<div class="real-time-val text-muted">—</div>`;
            }

            html += `
                <div class="stop-item">
                    <div class="stop-station">${station}</div>
                    <div class="stop-times">
                        <div class="theo-time">${formatTime(theo)}</div>
                        ${timeRealHtml}
                    </div>
                </div>
            `;
        });

        html += `</div>`;
        return html;
    }

    function parseTimeToMinutes(value) {
        if (value === undefined || value === null || value === "") {
            return null;
        }

        if (typeof value === "number") {
            if (Number.isNaN(value) || !Number.isFinite(value)) return null;
            return Math.round(value);
        }

        const stringValue = String(value).trim();
        if (!stringValue) return null;

        if (/^\d+$/.test(stringValue)) {
            return parseInt(stringValue, 10);
        }

        const match = stringValue.match(/^(\d{1,2}):(\d{2})/);
        if (match) {
            return parseInt(match[1], 10) * 60 + parseInt(match[2], 10);
        }

        const date = new Date(stringValue);
        if (!Number.isNaN(date.getTime())) {
            return date.getHours() * 60 + date.getMinutes();
        }

        return null;
    }

    function formatTime(value) {
        const totalMinutes = parseTimeToMinutes(value);
        if (totalMinutes === null) {
            return "—";
        }

        const normalized = ((totalMinutes % 1440) + 1440) % 1440;
        const hours = Math.floor(normalized / 60);
        const mins = normalized % 60;

        return `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}`;
    }

    function getDepartureTime(train) {
        if (!train) return null;
        if (train.departure) return train.departure;
        if (train.stops && train.stops.length > 0) {
            return train.stops[0].scheduled_departure || train.stops[0].scheduled_arrival;
        }
        return null;
    }

    function getArrivalTime(train) {
        if (!train) return null;
        if (train.arrival) return train.arrival;
        if (train.stops && train.stops.length > 0) {
            const last = train.stops[train.stops.length - 1];
            return last.scheduled_arrival || last.scheduled_departure;
        }
        return null;
    }

    function getTrainDelay(train) {
        if (!train) return 0;
        if (typeof train.final_delay_minutes === "number") return train.final_delay_minutes;
        return 0;
    }

    function hasTrainArrived(train, dateStr) {
        if (!train) return false;
        if (train.arrived === true) return true;

        const today = getTodayString();
        if (dateStr < today) return true;
        if (dateStr > today) return false;

        const arr = getArrivalTime(train);
        const arrMin = parseTimeToMinutes(arr);

        if (arrMin !== null) {
            const delay = getTrainDelay(train);
            // Mantenemos el tren visible 15 minutos más después de su llegada
            return arrMin + delay + 15 <= getNowMinutes();
        }

        return false;
    }

    function getNowMinutes() {
        const now = new Date();
        return now.getHours() * 60 + now.getMinutes();
    }

    function getTodayString() {
        const d = new Date();
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, "0");
        const dd = String(d.getDate()).padStart(2, "0");
        return `${yyyy}-${mm}-${dd}`;
    }

    function showLoading() {
        if (emptyState) {
            emptyState.style.display = "block";
            emptyState.textContent = "Carregant circulacions...";
        }
    }

    function hideEmptyState() {
        if (emptyState) {
            emptyState.style.display = "none";
        }
    }

    function renderEmpty(msg) {
        if (emptyState) {
            emptyState.style.display = "block";
            emptyState.textContent = msg;
        }
    }
});
