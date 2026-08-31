/* =======================================================
   form.js
   Logika khusus halaman "Buat Laporan":
   - Peta mini Leaflet untuk menentukan pinpoint lokasi
   - Pratinjau nama file foto/video yang dipilih
   - Penghitung karakter deskripsi
   - Ringkasan laporan otomatis (live preview)
   - Validasi & simulasi pengiriman form (belum ada database)
   ======================================================= */

(function () {
    "use strict";

    var BALI_CENTER = [-8.4095, 115.1889];

    // Batas wilayah yang boleh dipakai untuk pinpoint laporan, sebagai dua
    // poligon sederhana (garis pantai disederhanakan): [lat, lng] mengelilingi
    // tiap pulau searah jarum jam.
    // 1) Bali daratan (pulau utama)
    var BALI_MAINLAND_BOUNDARY = [
        [-8.17, 114.43], [-8.09, 114.55], [-8.06, 114.75], [-8.10, 114.95],
        [-8.08, 115.10], [-8.13, 115.25], [-8.20, 115.40], [-8.27, 115.55],
        [-8.34, 115.69], [-8.42, 115.64], [-8.50, 115.57], [-8.55, 115.51],
        [-8.59, 115.46], [-8.63, 115.41], [-8.68, 115.31], [-8.71, 115.26],
        [-8.75, 115.26], [-8.82, 115.24], [-8.86, 115.20], [-8.86, 115.14],
        [-8.83, 115.06], [-8.78, 115.08], [-8.72, 115.11], [-8.65, 115.07],
        [-8.55, 114.99], [-8.45, 114.89], [-8.42, 114.75], [-8.36, 114.55],
        [-8.27, 114.47], [-8.17, 114.43]
    ];

    // 2) Nusa Penida — tetap bagian dari Bali (Kabupaten Klungkung), dicek
    // sebagai poligon terpisah karena dipisahkan laut dari daratan utama.
    var NUSA_PENIDA_BOUNDARY = [
        [-8.68, 115.44], [-8.685, 115.50], [-8.695, 115.555], [-8.71, 115.60],
        [-8.735, 115.625], [-8.755, 115.615], [-8.765, 115.555], [-8.77, 115.50],
        [-8.76, 115.46], [-8.74, 115.435], [-8.71, 115.425], [-8.68, 115.44]
    ];

    var BALI_BOUNDS = [[-8.95, 114.35], [-8.00, 115.80]];

    // Ray-casting: mengecek apakah titik [lat,lng] berada di dalam satu poligon.
    function pointInPolygon(lat, lng, polygon) {
        var inside = false;
        for (var i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
            var yi = polygon[i][0], xi = polygon[i][1];
            var yj = polygon[j][0], xj = polygon[j][1];
            var intersects = (yi > lat) !== (yj > lat) &&
                lng < (xj - xi) * (lat - yi) / (yj - yi) + xi;
            if (intersects) inside = !inside;
        }
        return inside;
    }

    // Valid jika titik berada di daratan utama ATAU di Nusa Penida.
    function isInsideBali(lat, lng) {
        return pointInPolygon(lat, lng, BALI_MAINLAND_BOUNDARY) ||
            pointInPolygon(lat, lng, NUSA_PENIDA_BOUNDARY);
    }

    var CATEGORY_LABELS = {
        organik: "Sampah Organik",
        anorganik: "Sampah Anorganik",
        elektronik: "Sampah Elektronik (E-Waste)",
        b3: "Limbah B3 (Berbahaya)",
        medis: "Sampah Medis",
        lainnya: "Lainnya"
    };

    var SEVERITY_LABELS = {
        low: "Rendah",
        medium: "Sedang",
        high: "Tinggi"
    };

    var selectedLatLng = null;
    var pickerMarker = null;

    /* ---------- Peta pemilih pinpoint ---------- */
    function initMapPicker() {
        var mapEl = document.getElementById("map-picker");
        if (!mapEl || typeof L === "undefined") return;

        var map = L.map(mapEl, {
            scrollWheelZoom: false,
            maxBounds: BALI_BOUNDS,
            maxBoundsViscosity: 0.8,
            minZoom: 9
        }).setView(BALI_CENTER, 10);

        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
            maxZoom: 18,
            attribution: "&copy; OpenStreetMap contributors"
        }).addTo(map);

        map.on("click", function (event) {
            if (!isInsideBali(event.latlng.lat, event.latlng.lng)) {
                showFieldError("pin-error", "Lokasi harus berada di dalam wilayah Pulau Bali. Silakan pilih titik lain.");
                return;
            }
            setSelectedLocation(map, event.latlng.lat, event.latlng.lng);
        });

        // Aktifkan zoom scroll hanya setelah peta difokus, agar tidak
        // mengganggu scroll halaman saat pengguna menggulir form.
        mapEl.addEventListener("click", function () {
            map.scrollWheelZoom.enable();
        });
        mapEl.addEventListener("mouseleave", function () {
            map.scrollWheelZoom.disable();
        });
    }

    function setSelectedLocation(map, lat, lng) {
        selectedLatLng = { lat: lat, lng: lng };

        var latInput = document.getElementById("latitude");
        var lngInput = document.getElementById("longitude");
        if (latInput) latInput.value = lat.toFixed(6);
        if (lngInput) lngInput.value = lng.toFixed(6);

        var coordText = document.getElementById("coord-text");
        if (coordText) {
            coordText.innerHTML =
                "Lokasi dipilih: <strong>" + lat.toFixed(5) + ", " + lng.toFixed(5) + "</strong>";
        }

        var icon = L.divIcon({
            className: "",
            html: '<div class="marker-pin marker-pin--select"></div>',
            iconSize: [26, 26],
            iconAnchor: [13, 26]
        });

        if (pickerMarker) {
            pickerMarker.setLatLng([lat, lng]);
        } else {
            pickerMarker = L.marker([lat, lng], { icon: icon, draggable: true }).addTo(map);
            pickerMarker.on("dragend", function () {
                var pos = pickerMarker.getLatLng();
                if (!isInsideBali(pos.lat, pos.lng)) {
                    showFieldError("pin-error", "Lokasi harus berada di dalam wilayah Pulau Bali. Penanda dikembalikan ke posisi terakhir yang valid.");
                    pickerMarker.setLatLng([selectedLatLng.lat, selectedLatLng.lng]);
                    return;
                }
                setSelectedLocation(map, pos.lat, pos.lng);
            });
        }

        updateSummary();
        clearFieldError("pin-error");
    }

    /* ---------- Pratinjau nama file bukti ---------- */
    function initFileInput() {
        var input = document.getElementById("evidence-file");
        var display = document.getElementById("upload-filename");
        var zone = document.getElementById("upload-zone");
        if (!input || !display) return;

        function updateFileDisplay() {
            if (input.files && input.files.length > 0) {
                var file = input.files[0];
                var sizeKB = Math.round(file.size / 1024);
                display.textContent = file.name + " (" + sizeKB + " KB)";
                display.classList.add("is-visible");
            } else {
                display.textContent = "";
                display.classList.remove("is-visible");
            }
        }

        input.addEventListener("change", updateFileDisplay);

        if (!zone) return;

        ["dragover", "dragleave", "drop"].forEach(function (evt) {
            zone.addEventListener(evt, function (e) {
                e.preventDefault();
                zone.classList.toggle("is-dragover", evt === "dragover");

                if (evt === "drop" && e.dataTransfer && e.dataTransfer.files.length > 0) {
                    input.files = e.dataTransfer.files;
                    updateFileDisplay();
                }
            });
        });
    }

    /* ---------- Penghitung karakter deskripsi ---------- */
    function initCharCounter() {
        var textarea = document.getElementById("description");
        var counter = document.getElementById("description-counter");
        if (!textarea || !counter) return;

        var max = parseInt(textarea.getAttribute("maxlength"), 10) || 300;

        function update() {
            counter.textContent = textarea.value.length + " / " + max;
        }

        update();
        textarea.addEventListener("input", update);
    }

    /* ---------- Ringkasan laporan (live preview) ---------- */
    function updateSummary() {
        setSummaryValue("summary-address", getValue("address") || "Belum diisi");
        setSummaryValue(
            "summary-location",
            selectedLatLng
                ? selectedLatLng.lat.toFixed(4) + ", " + selectedLatLng.lng.toFixed(4)
                : "Belum dipilih"
        );

        var categoryEl = document.getElementById("category");
        var categoryValue = categoryEl && categoryEl.value ? CATEGORY_LABELS[categoryEl.value] : "Belum dipilih";
        setSummaryValue("summary-category", categoryValue);

        var severityInput = document.querySelector('input[name="severity"]:checked');
        setSummaryValue("summary-severity", severityInput ? SEVERITY_LABELS[severityInput.value] : "Belum dipilih");
    }

    function setSummaryValue(id, text) {
        var el = document.getElementById(id);
        if (el) el.textContent = text;
    }

    function getValue(id) {
        var el = document.getElementById(id);
        return el ? el.value.trim() : "";
    }

    function initLiveSummary() {
        var watchedIds = ["address", "category"];
        watchedIds.forEach(function (id) {
            var el = document.getElementById(id);
            if (el) el.addEventListener("input", updateSummary);
            if (el) el.addEventListener("change", updateSummary);
        });

        document.querySelectorAll('input[name="severity"]').forEach(function (el) {
            el.addEventListener("change", updateSummary);
        });

        updateSummary();
    }

    /* ---------- Validasi & simulasi kirim ---------- */
    function showFieldError(id, message) {
        var el = document.getElementById(id);
        if (el) {
            el.textContent = message;
            el.classList.add("is-visible");
        }
    }

    function clearFieldError(id) {
        var el = document.getElementById(id);
        if (el) {
            el.textContent = "";
            el.classList.remove("is-visible");
        }
    }

    function showToast(message) {
        var toast = document.getElementById("form-toast");
        if (!toast) return;
        toast.querySelector("span").textContent = message;
        toast.classList.add("is-visible");
        window.clearTimeout(showToast._timer);
        showToast._timer = window.setTimeout(function () {
            toast.classList.remove("is-visible");
        }, 4000);
    }

    function initFormSubmit() {
        var form = document.getElementById("report-form");
        if (!form) return;

        form.addEventListener("submit", function (event) {
            event.preventDefault();
            clearFieldError("pin-error");

            if (!selectedLatLng) {
                showFieldError("pin-error", "Silakan tentukan lokasi kejadian pada peta terlebih dahulu.");
                document.getElementById("map-picker").scrollIntoView({ behavior: "smooth", block: "center" });
                return;
            }

            if (!form.checkValidity()) {
                form.reportValidity();
                return;
            }

            // Belum terhubung ke database — ini hanya simulasi front-end.
            showToast("Laporan berhasil disiapkan! (Simulasi — belum tersambung ke database)");
            form.reset();
            selectedLatLng = null;
            if (pickerMarker) {
                pickerMarker.remove();
                pickerMarker = null;
            }
            var coordText = document.getElementById("coord-text");
            if (coordText) coordText.innerHTML = "Belum ada lokasi yang dipilih.";
            var display = document.getElementById("upload-filename");
            if (display) {
                display.textContent = "";
                display.classList.remove("is-visible");
            }
            updateSummary();
            document.getElementById("description-counter").textContent = "0 / 300";
        });

        form.addEventListener("reset", function () {
            window.setTimeout(updateSummary, 0);
        });
    }

    document.addEventListener("DOMContentLoaded", function () {
        initMapPicker();
        initFileInput();
        initCharCounter();
        initLiveSummary();
        initFormSubmit();
    });
})();
