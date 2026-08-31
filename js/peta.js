/* =======================================================
   peta.js
   Logika khusus halaman "Peta Laporan":
   - Data contoh laporan (belum tersambung ke database)
   - Render pinpoint pada peta Leaflet sesuai tingkat keparahan
   - Panel filter (tingkat keparahan & kategori sampah)
   - Popup detail laporan saat pin diklik
   - Simulasi: laporan berstatus "Selesai" hilang otomatis dari peta
     beberapa hari setelah tanggal penyelesaiannya
   ======================================================= */

(function () {
    "use strict";

    var BALI_CENTER = [-8.4, 115.19];
    var HARI_SEBELUM_HILANG = 3; // laporan selesai disembunyikan setelah sekian hari

    var CATEGORY_LABELS = {
        organik: "Sampah Organik",
        anorganik: "Sampah Anorganik",
        elektronik: "Sampah Elektronik (E-Waste)",
        b3: "Limbah B3 (Berbahaya)",
        medis: "Sampah Medis",
        lainnya: "Lainnya"
    };

    var SEVERITY_LABELS = { low: "Rendah", medium: "Sedang", high: "Tinggi" };

    /* ---------- Data contoh laporan (dummy, menunggu database asli) ---------- */
    var REPORTS = [
        { id: 1, lat: -8.7184, lng: 115.1686, address: "Jl. Pantai Kuta, Kuta, Badung", category: "anorganik", severity: "high", status: "aktif", daysAgo: 1 },
        { id: 2, lat: -8.6478, lng: 115.1385, address: "Jl. Raya Canggu, Canggu, Badung", category: "anorganik", severity: "medium", status: "aktif", daysAgo: 2 },
        { id: 3, lat: -8.5069, lng: 115.2625, address: "Jl. Monkey Forest, Ubud, Gianyar", category: "organik", severity: "low", status: "selesai", daysAgo: 6, resolvedDaysAgo: 1 },
        { id: 4, lat: -8.6788, lng: 115.2624, address: "Jl. Danau Tamblingan, Sanur, Denpasar", category: "b3", severity: "high", status: "aktif", daysAgo: 0 },
        { id: 5, lat: -8.7997, lng: 115.2255, address: "Kawasan ITDC, Nusa Dua, Badung", category: "anorganik", severity: "medium", status: "selesai", daysAgo: 9, resolvedDaysAgo: 5 },
        { id: 6, lat: -8.7909, lng: 115.1587, address: "Jl. Uluwatu, Jimbaran, Badung", category: "elektronik", severity: "medium", status: "aktif", daysAgo: 3 },
        { id: 7, lat: -8.6705, lng: 115.2126, address: "Jl. Diponegoro, Denpasar", category: "medis", severity: "high", status: "aktif", daysAgo: 1 },
        { id: 8, lat: -8.1120, lng: 115.0882, address: "Jl. Ngurah Rai, Singaraja, Buleleng", category: "organik", severity: "low", status: "aktif", daysAgo: 4 },
        { id: 9, lat: -8.3405, lng: 115.6613, address: "Jl. Raya Amed, Karangasem", category: "lainnya", severity: "low", status: "selesai", daysAgo: 5, resolvedDaysAgo: 2 },
        { id: 10, lat: -8.1571, lng: 115.0245, address: "Jl. Raya Lovina, Buleleng", category: "anorganik", severity: "low", status: "aktif", daysAgo: 6 },
        { id: 11, lat: -8.5385, lng: 115.3284, address: "Jl. Ngurah Rai, Gianyar", category: "b3", severity: "medium", status: "aktif", daysAgo: 2 },
        { id: 12, lat: -8.5386, lng: 115.4045, address: "Jl. Flamboyan, Klungkung", category: "organik", severity: "medium", status: "selesai", daysAgo: 10, resolvedDaysAgo: 7 }
    ];

    var map = null;
    var markerLayer = null;

    function formatDate(daysAgo) {
        var date = new Date();
        date.setDate(date.getDate() - daysAgo);
        return date.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
    }

    /* Laporan selesai otomatis hilang dari peta setelah beberapa hari */
    function isReportVisible(report) {
        if (report.status === "selesai" && report.resolvedDaysAgo > HARI_SEBELUM_HILANG) {
            return false;
        }
        return true;
    }

    function getActiveFilters() {
        var severities = Array.from(
            document.querySelectorAll('input[name="filter-severity"]:checked')
        ).map(function (el) { return el.value; });

        var categories = Array.from(
            document.querySelectorAll('input[name="filter-category"]:checked')
        ).map(function (el) { return el.value; });

        return { severities: severities, categories: categories };
    }

    function buildMarkerIcon(severity) {
        return L.divIcon({
            className: "",
            html: '<div class="marker-pin marker-pin--' + severity + '"></div>',
            iconSize: [26, 26],
            iconAnchor: [13, 26],
            popupAnchor: [0, -26]
        });
    }

    function buildPopupContent(report) {
        var statusClass = report.status === "selesai" ? "popup-status--done" : "popup-status--active";
        var statusText = report.status === "selesai" ? "Selesai Ditangani" : "Menunggu Tindak Lanjut";

        return (
            '<div class="popup-card">' +
            '<div class="photo-frame">' +
            '<svg viewBox="0 0 24 24" fill="none" stroke-width="1.6"><rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="8.5" cy="10.5" r="1.5"/><path d="m21 15-5-5L5 19"/></svg>' +
            "<span>Foto/video menyusul</span>" +
            "</div>" +
            '<div class="popup-body">' +
            '<span class="popup-status ' + statusClass + '">' + statusText + "</span>" +
            '<p class="popup-address">' + report.address + "</p>" +
            '<div class="popup-meta">' +
            "<span>Kategori: " + CATEGORY_LABELS[report.category] + "</span>" +
            "<span>Tanggal lapor: " + formatDate(report.daysAgo) + "</span>" +
            "</div>" +
            '<span class="popup-severity"><span class="dot" style="background:var(--severity-' + report.severity + ')"></span>Tingkat keparahan: ' + SEVERITY_LABELS[report.severity] + "</span>" +
            "</div>" +
            "</div>"
        );
    }

    function renderMarkers() {
        var filters = getActiveFilters();
        markerLayer.clearLayers();

        var visibleReports = REPORTS.filter(isReportVisible);
        var shown = 0;

        // Jika tidak ada filter yang dipilih sama sekali (kedua grup kosong),
        // tidak ada laporan yang ditampilkan (kondisi awal 0 dari total).
        var noFilterSelected = filters.severities.length === 0 && filters.categories.length === 0;

        if (!noFilterSelected) {
            visibleReports.forEach(function (report) {
                // Grup filter yang kosong dianggap "tidak membatasi" —
                // laporan tetap tampil selama grup yang DIPILIH cocok.
                var matchesSeverity = filters.severities.length === 0 ||
                    filters.severities.indexOf(report.severity) !== -1;
                var matchesCategory = filters.categories.length === 0 ||
                    filters.categories.indexOf(report.category) !== -1;

                if (!matchesSeverity || !matchesCategory) return;

                shown += 1;
                var marker = L.marker([report.lat, report.lng], { icon: buildMarkerIcon(report.severity) });
                marker.bindPopup(buildPopupContent(report));
                markerLayer.addLayer(marker);
            });
        }

        updateResultsCount(shown, visibleReports.length);
    }

    function updateResultsCount(shown, total) {
        var el = document.getElementById("results-count-value");
        if (el) {
            el.innerHTML = "Menampilkan <strong>" + shown + "</strong> dari <strong>" + total + "</strong> laporan aktif";
        }
    }

    function initMap() {
        var mapEl = document.getElementById("map-laporan");
        if (!mapEl || typeof L === "undefined") return;

        map = L.map(mapEl).setView(BALI_CENTER, 10);

        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
            maxZoom: 18,
            attribution: "&copy; OpenStreetMap contributors"
        }).addTo(map);

        markerLayer = L.layerGroup().addTo(map);
        renderMarkers();
    }

    function initFilters() {
        var checkboxes = document.querySelectorAll(
            'input[name="filter-severity"], input[name="filter-category"]'
        );
        checkboxes.forEach(function (el) {
            el.addEventListener("change", renderMarkers);
        });

        var resetBtn = document.getElementById("filter-reset");
        if (resetBtn) {
            resetBtn.addEventListener("click", function () {
                checkboxes.forEach(function (el) { el.checked = true; });
                renderMarkers();
            });
        }

        var toggleBtn = document.getElementById("filter-toggle");
        var filterBar = document.getElementById("filter-bar");
        if (toggleBtn && filterBar) {
            toggleBtn.addEventListener("click", function () {
                var isOpen = filterBar.classList.toggle("is-open");
                toggleBtn.setAttribute("aria-expanded", String(isOpen));
            });
        }
    }

    document.addEventListener("DOMContentLoaded", function () {
        initMap();
        initFilters();
    });
})();
