/* =======================================================
   main.js
   Logika yang dipakai bersama di semua halaman:
   - Toggle menu navbar untuk layar kecil (hamburger)
   - Efek bayangan navbar saat halaman discroll
   - Tahun otomatis pada footer (hak cipta)
   - Animasi "muncul" saat elemen discroll ke layar
   - Animasi hitung angka pada kartu statistik
   ======================================================= */

(function () {
    "use strict";

    /* ---------- Navbar: menu hamburger untuk mobile ---------- */
    function initNavToggle() {
        var toggle = document.querySelector(".nav-toggle");
        var menu = document.querySelector(".site-header nav ul");
        var header = document.querySelector(".site-header");

        if (!toggle || !menu || !header) return;

        function closeMenu() {
            menu.classList.remove("nav-open");
            toggle.setAttribute("aria-expanded", "false");
        }

        function openMenu() {
            menu.classList.add("nav-open");
            toggle.setAttribute("aria-expanded", "true");
        }

        toggle.addEventListener("click", function (event) {
            event.stopPropagation();
            var isOpen = menu.classList.contains("nav-open");
            if (isOpen) {
                closeMenu();
            } else {
                openMenu();
            }
        });

        // Menutup menu otomatis ketika salah satu tautan diklik (khusus mobile)
        menu.querySelectorAll("a").forEach(function (link) {
            link.addEventListener("click", closeMenu);
        });

        // Menutup menu ketika area di luar navbar diklik/disentuh
        document.addEventListener("click", function (event) {
            if (!menu.classList.contains("nav-open")) return;
            if (header.contains(event.target)) return;
            closeMenu();
        });

        // Menutup menu dengan tombol Escape (aksesibilitas keyboard)
        document.addEventListener("keydown", function (event) {
            if (event.key === "Escape" && menu.classList.contains("nav-open")) {
                closeMenu();
                toggle.focus();
            }
        });
    }

    /* ---------- Navbar: bayangan lebih tegas saat discroll ---------- */
    function initNavScrollShadow() {
        var nav = document.querySelector(".site-header nav");
        if (!nav) return;

        function updateShadow() {
            if (window.scrollY > 8) {
                nav.classList.add("is-scrolled");
            } else {
                nav.classList.remove("is-scrolled");
            }
        }

        updateShadow();
        window.addEventListener("scroll", updateShadow, { passive: true });
    }

    /* ---------- Footer: tahun berjalan otomatis ---------- */
    function initFooterYear() {
        var yearEl = document.getElementById("footer-year");
        if (!yearEl) return;
        yearEl.textContent = new Date().getFullYear();
    }

    /* ---------- Animasi muncul saat elemen masuk viewport ---------- */
    function initScrollReveal() {
        var targets = document.querySelectorAll(".reveal");
        if (!targets.length) return;

        if (!("IntersectionObserver" in window)) {
            targets.forEach(function (el) { el.classList.add("is-visible"); });
            return;
        }

        var observer = new IntersectionObserver(
            function (entries) {
                entries.forEach(function (entry) {
                    if (entry.isIntersecting) {
                        entry.target.classList.add("is-visible");
                        observer.unobserve(entry.target);
                    }
                });
            },
            { threshold: 0.15, rootMargin: "0px 0px -40px 0px" }
        );

        targets.forEach(function (el) { observer.observe(el); });
    }

    /* ---------- Animasi hitung angka statistik ---------- */
    function animateCount(el) {
        var target = parseInt(el.getAttribute("data-target"), 10);
        if (isNaN(target)) return;

        var duration = 1400;
        var startTime = null;

        function step(timestamp) {
            if (startTime === null) startTime = timestamp;
            var progress = Math.min((timestamp - startTime) / duration, 1);
            var eased = 1 - Math.pow(1 - progress, 3);
            var current = Math.round(eased * target);
            el.textContent = current.toLocaleString("id-ID");

            if (progress < 1) {
                window.requestAnimationFrame(step);
            } else {
                el.textContent = target.toLocaleString("id-ID");
            }
        }

        window.requestAnimationFrame(step);
    }

    function initStatCounters() {
        var counters = document.querySelectorAll(".stat-number[data-target]");
        if (!counters.length) return;

        if (!("IntersectionObserver" in window)) {
            counters.forEach(animateCount);
            return;
        }

        var observer = new IntersectionObserver(
            function (entries) {
                entries.forEach(function (entry) {
                    if (entry.isIntersecting) {
                        animateCount(entry.target);
                        observer.unobserve(entry.target);
                    }
                });
            },
            { threshold: 0.4 }
        );

        counters.forEach(function (el) { observer.observe(el); });
    }

    /* ---------- Carousel dokumentasi: navigasi manual kiri/kanan ---------- */
    function initDocumentationCarousel() {
        var track = document.getElementById("gallery-track");
        var prevBtn = document.getElementById("gallery-prev");
        var nextBtn = document.getElementById("gallery-next");

        if (!track || !prevBtn || !nextBtn) return;

        function updateButtons() {
            var maxScroll = track.scrollWidth - track.clientWidth;
            prevBtn.disabled = track.scrollLeft <= 4;
            nextBtn.disabled = track.scrollLeft >= maxScroll - 4;
        }

        function scrollByPage(direction) {
            track.scrollBy({ left: direction * track.clientWidth * 0.9, behavior: "smooth" });
        }

        prevBtn.addEventListener("click", function () { scrollByPage(-1); });
        nextBtn.addEventListener("click", function () { scrollByPage(1); });
        track.addEventListener("scroll", updateButtons, { passive: true });
        window.addEventListener("resize", updateButtons);

        updateButtons();
    }

    document.addEventListener("DOMContentLoaded", function () {
        initNavToggle();
        initNavScrollShadow();
        initFooterYear();
        initScrollReveal();
        initStatCounters();
        initDocumentationCarousel();
    });
})();
