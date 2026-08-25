// =========================================================
// STŘÍHÁNÍ METRU - CORE ENGINE & INTERACTION LOGIC
// =========================================================

// Robust Date Helpers (local date strings YYYY-MM-DD without UTC timezone drift)
function parseLocalDate(dateStr) {
    if (!dateStr) return new Date();
    const parts = dateStr.split('-').map(Number);
    if (parts.length !== 3 || isNaN(parts[0])) return new Date();
    return new Date(parts[0], parts[1] - 1, parts[2]);
}

function formatLocalDate(d) {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function getTodayStr() {
    return formatLocalDate(new Date());
}

function addDaysToStr(dateStr, days) {
    const d = parseLocalDate(dateStr);
    d.setDate(d.getDate() + days);
    return formatLocalDate(d);
}

function diffDaysStr(startStr, endStr) {
    const d1 = parseLocalDate(startStr);
    const d2 = parseLocalDate(endStr);
    const diff = d2.getTime() - d1.getTime();
    return Math.round(diff / (1000 * 60 * 60 * 24));
}

class MeterApp {
    constructor() {
        this.STORAGE_KEY = 'strihani_metru_data_v2';
        this.OLD_STORAGE_KEY = 'strihani_metru_data_v1';
        
        this.defaultState = {
            title: 'Odpočet do Dne D 💯',
            startDate: getTodayStr(),
            totalDays: 100,
            targetDate: addDaysToStr(getTodayStr(), 100),
            cutDays: 0,
            numberingDirection: 'desc', // 'desc' = od 100 do 1 (tradiční), 'asc' = od 1 do 100
            theme: 'tailor',
            soundEnabled: true,
            milestones: [
                { day: 100, label: 'Začátek metru (100)!', icon: '🚀' },
                { day: 50, label: 'Půlka za námi (50)!', icon: '⚡' },
                { day: 10, label: 'Finiš (posledních 10)!', icon: '🔥' },
                { day: 1, label: 'Poslední den (1)!', icon: '🏆' }
            ],
            diary: []
        };

        this.state = this.loadState();
        this.particles = [];
        this.animFrame = null;

        this.initDOM();
        this.initCanvas();
        this.bindEvents();
        this.applyTheme(this.state.theme);
        this.renderAll();
    }

    loadState() {
        try {
            // Check current storage v2
            const saved = localStorage.getItem(this.STORAGE_KEY);
            if (saved) {
                const parsed = JSON.parse(saved);
                return {
                    ...this.defaultState,
                    ...parsed,
                    numberingDirection: parsed.numberingDirection || 'desc'
                };
            }

            // Check older v1 storage
            const oldSaved = localStorage.getItem(this.OLD_STORAGE_KEY);
            if (oldSaved) {
                const parsed = JSON.parse(oldSaved);
                // Upgrade to 100 days default if totalDays was 30
                const totalDays = (parsed.totalDays === 30 || !parsed.totalDays) ? 100 : parsed.totalDays;
                const startDate = parsed.startDate || getTodayStr();
                const targetDate = addDaysToStr(startDate, totalDays);

                return {
                    ...this.defaultState,
                    ...parsed,
                    totalDays: totalDays,
                    targetDate: targetDate,
                    numberingDirection: 'desc',
                    milestones: [
                        { day: totalDays, label: `Začátek metru (${totalDays})!`, icon: '🚀' },
                        { day: Math.round(totalDays / 2), label: `Půlka za námi (${Math.round(totalDays / 2)})!`, icon: '⚡' },
                        { day: Math.min(10, totalDays), label: 'Finiš (posledních 10)!', icon: '🔥' },
                        { day: 1, label: 'Poslední den (1)!', icon: '🏆' }
                    ]
                };
            }
        } catch (e) {
            console.error('Chyba při načítání stavu z localStorage:', e);
        }
        return { ...this.defaultState };
    }

    saveState() {
        try {
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.state));
        } catch (e) {
            console.error('Chyba při ukládání stavu do localStorage:', e);
        }
    }

    initDOM() {
        this.dom = {
            eventTitle: document.getElementById('event-title'),
            eventTargetDate: document.getElementById('event-target-date'),
            eventBadge: document.getElementById('event-badge'),
            progressBarFill: document.getElementById('progress-bar-fill'),
            progressText: document.getElementById('progress-text'),
            statCut: document.getElementById('stat-cut'),
            statRemaining: document.getElementById('stat-remaining'),
            statPercent: document.getElementById('stat-percent'),
            tapeContainer: document.getElementById('measuring-tape'),
            tapeScrollArea: document.getElementById('tape-scroll-area'),
            diaryList: document.getElementById('diary-list'),
            btnCutNext: document.getElementById('btn-cut-next'),
            btnCutToToday: document.getElementById('btn-cut-to-today'),
            btnSettings: document.getElementById('btn-settings'),
            btnSoundToggle: document.getElementById('btn-sound-toggle'),
            btnThemeSelect: document.getElementById('theme-select'),
            btnAddMilestone: document.getElementById('btn-add-milestone'),
            btnReset: document.getElementById('btn-reset'),
            btnExport: document.getElementById('btn-export'),

            // Modals
            settingsModal: document.getElementById('settings-modal'),
            milestoneModal: document.getElementById('milestone-modal'),
            diaryModal: document.getElementById('diary-modal'),
            modalCloseBtns: document.querySelectorAll('.modal-close-btn'),

            // Form inputs
            inputTitle: document.getElementById('input-title'),
            inputTotalDays: document.getElementById('input-total-days'),
            selectNumberingOrder: document.getElementById('select-numbering-order'),
            inputTargetDate: document.getElementById('input-target-date'),
            inputStartDate: document.getElementById('input-start-date'),
            formSettings: document.getElementById('form-settings'),
            formMilestone: document.getElementById('form-milestone'),
            inputMilestoneDay: document.getElementById('input-milestone-day'),
            inputMilestoneLabel: document.getElementById('input-milestone-label'),
            inputMilestoneIcon: document.getElementById('input-milestone-icon'),
            diaryNoteText: document.getElementById('diary-note-text'),
            btnSaveDiaryNote: document.getElementById('btn-save-diary-note'),
            currentCutDayLabel: document.getElementById('current-cut-day-label'),

            toastContainer: document.getElementById('toast-container'),
            fxCanvas: document.getElementById('fx-canvas')
        };
    }

    initCanvas() {
        this.ctx = this.dom.fxCanvas.getContext('2d');
        this.resizeCanvas();
        window.addEventListener('resize', () => this.resizeCanvas());
        this.renderParticles();
    }

    resizeCanvas() {
        this.dom.fxCanvas.width = window.innerWidth;
        this.dom.fxCanvas.height = window.innerHeight;
    }

    bindEvents() {
        // Cut next day button
        this.dom.btnCutNext.addEventListener('click', (e) => {
            this.cutNextDay(e);
        });

        // Sync with today
        this.dom.btnCutToToday.addEventListener('click', () => {
            this.syncWithToday();
        });

        // Sound toggle
        this.dom.btnSoundToggle.addEventListener('click', () => {
            const enabled = window.soundFx.toggleSound();
            this.state.soundEnabled = enabled;
            this.saveState();
            this.dom.btnSoundToggle.innerHTML = enabled ? '🔊 Zvuk: Zapnut' : '🔇 Zvuk: Vypnut';
            this.showToast(enabled ? 'Zvuk zapnut' : 'Zvuk ztlumen');
        });

        // Theme selector
        this.dom.btnThemeSelect.addEventListener('change', (e) => {
            this.applyTheme(e.target.value);
        });

        // Modal Openers & Closers
        this.dom.btnSettings.addEventListener('click', () => this.openSettingsModal());
        this.dom.btnAddMilestone.addEventListener('click', () => this.openMilestoneModal());

        this.dom.modalCloseBtns.forEach(btn => {
            btn.addEventListener('click', () => this.closeAllModals());
        });

        // Close on backdrop click
        [this.dom.settingsModal, this.dom.milestoneModal, this.dom.diaryModal].forEach(modal => {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) this.closeAllModals();
            });
        });

        // Settings Modal 2-Way Sync between total days and target date
        if (this.dom.inputTotalDays && this.dom.inputStartDate && this.dom.inputTargetDate) {
            this.dom.inputTotalDays.addEventListener('input', () => {
                const days = parseInt(this.dom.inputTotalDays.value, 10);
                const start = this.dom.inputStartDate.value || getTodayStr();
                if (days > 0) {
                    this.dom.inputTargetDate.value = addDaysToStr(start, days);
                }
            });

            this.dom.inputStartDate.addEventListener('change', () => {
                const days = parseInt(this.dom.inputTotalDays.value, 10) || 100;
                const start = this.dom.inputStartDate.value || getTodayStr();
                this.dom.inputTargetDate.value = addDaysToStr(start, days);
            });

            this.dom.inputTargetDate.addEventListener('change', () => {
                const start = this.dom.inputStartDate.value || getTodayStr();
                const target = this.dom.inputTargetDate.value;
                const diff = diffDaysStr(start, target);
                if (diff > 0) {
                    this.dom.inputTotalDays.value = diff;
                }
            });
        }

        // Settings Form Submit
        this.dom.formSettings.addEventListener('submit', (e) => {
            e.preventDefault();
            this.saveSettings();
        });

        // Milestone Form Submit
        this.dom.formMilestone.addEventListener('submit', (e) => {
            e.preventDefault();
            this.saveMilestone();
        });

        // Diary save
        this.dom.btnSaveDiaryNote.addEventListener('click', () => {
            this.saveDiaryNote();
        });

        // Reset
        this.dom.btnReset.addEventListener('click', () => {
            if (confirm('Opravdu chcete obnovit odpočet od začátku (vynulovat ustřižené dny)?')) {
                this.state.cutDays = 0;
                this.state.diary = [];
                this.saveState();
                this.renderAll();
                window.soundFx.playTapeRattle();
                this.showToast('Metr byl obnoven na začátek!');
            }
        });

        // Export / Share
        this.dom.btnExport.addEventListener('click', () => {
            this.shareProgress();
        });

        // Preset chips in settings
        document.querySelectorAll('.chip-btn').forEach(chip => {
            chip.addEventListener('click', (e) => {
                const days = parseInt(e.currentTarget.dataset.days, 10);
                const title = e.currentTarget.dataset.title;
                const start = this.dom.inputStartDate.value || getTodayStr();
                if (days) {
                    if (this.dom.inputTotalDays) {
                        this.dom.inputTotalDays.value = days;
                    }
                    this.dom.inputTargetDate.value = addDaysToStr(start, days);
                }
                if (title) {
                    this.dom.inputTitle.value = title;
                }
            });
        });

        // Drag to scroll horizontal tape
        let isDown = false;
        let startX, scrollLeft;
        const slider = this.dom.tapeScrollArea;

        slider.addEventListener('mousedown', (e) => {
            isDown = true;
            slider.style.cursor = 'grabbing';
            startX = e.pageX - slider.offsetLeft;
            scrollLeft = slider.scrollLeft;
        });
        slider.addEventListener('mouseleave', () => {
            isDown = false;
            slider.style.cursor = 'grab';
        });
        slider.addEventListener('mouseup', () => {
            isDown = false;
            slider.style.cursor = 'grab';
        });
        slider.addEventListener('mousemove', (e) => {
            if (!isDown) return;
            e.preventDefault();
            const x = e.pageX - slider.offsetLeft;
            const walk = (x - startX) * 1.5;
            slider.scrollLeft = scrollLeft - walk;
        });
    }

    applyTheme(theme) {
        this.state.theme = theme;
        document.body.removeAttribute('data-theme');
        if (theme !== 'tailor') {
            document.body.setAttribute('data-theme', theme);
        }
        this.dom.btnThemeSelect.value = theme;
        this.saveState();
    }

    openSettingsModal() {
        this.dom.inputTitle.value = this.state.title;
        this.dom.inputStartDate.value = this.state.startDate || getTodayStr();
        this.dom.inputTargetDate.value = this.state.targetDate || addDaysToStr(getTodayStr(), 100);
        if (this.dom.inputTotalDays) {
            this.dom.inputTotalDays.value = this.state.totalDays || 100;
        }
        if (this.dom.selectNumberingOrder) {
            this.dom.selectNumberingOrder.value = this.state.numberingDirection || 'desc';
        }
        this.dom.settingsModal.classList.add('active');
    }

    openMilestoneModal() {
        const nextCutIndex = this.state.cutDays + 1;
        const defaultNum = this.getDisplayNumberForIndex(Math.min(nextCutIndex, this.state.totalDays));
        
        this.dom.inputMilestoneDay.value = defaultNum;
        this.dom.inputMilestoneDay.min = 1;
        this.dom.inputMilestoneDay.max = this.state.totalDays;
        this.dom.inputMilestoneLabel.value = '';
        this.dom.milestoneModal.classList.add('active');
    }

    closeAllModals() {
        document.querySelectorAll('.modal-backdrop').forEach(m => m.classList.remove('active'));
    }

    saveSettings() {
        const title = this.dom.inputTitle.value.trim() || 'Můj metr';
        const startDate = this.dom.inputStartDate.value || getTodayStr();
        const numberingDirection = this.dom.selectNumberingOrder ? this.dom.selectNumberingOrder.value : 'desc';

        let totalDays = parseInt(this.dom.inputTotalDays ? this.dom.inputTotalDays.value : 0, 10);
        let targetDate = this.dom.inputTargetDate.value;

        if (!totalDays || totalDays < 1) {
            totalDays = Math.max(1, diffDaysStr(startDate, targetDate));
        } else {
            targetDate = addDaysToStr(startDate, totalDays);
        }

        this.state.title = title;
        this.state.startDate = startDate;
        this.state.targetDate = targetDate;
        this.state.totalDays = totalDays;
        this.state.numberingDirection = numberingDirection;
        this.state.cutDays = Math.min(this.state.cutDays, totalDays);

        this.saveState();
        this.closeAllModals();
        this.renderAll();
        window.soundFx.playTapeRattle();
        this.showToast('Nastavení metru (od 100 do 1) bylo úspěšně uloženo!');
    }

    saveMilestone() {
        const day = parseInt(this.dom.inputMilestoneDay.value, 10);
        const label = this.dom.inputMilestoneLabel.value.trim() || 'Milník';
        const icon = this.dom.inputMilestoneIcon.value || '⭐';

        if (day >= 1 && day <= this.state.totalDays) {
            // Remove existing on same display day
            this.state.milestones = this.state.milestones.filter(m => m.day !== day);
            this.state.milestones.push({ day, label, icon });
            this.state.milestones.sort((a, b) => (this.state.numberingDirection === 'desc' ? b.day - a.day : a.day - b.day));

            this.saveState();
            this.closeAllModals();
            this.renderAll();
            this.showToast(`Milník "${label}" přidán na centimetr č. ${day}!`);
        }
    }

    getDisplayNumberForIndex(cutIndex) {
        if (this.state.numberingDirection === 'desc') {
            return this.state.totalDays - (cutIndex - 1);
        }
        return cutIndex;
    }

    calculateMetrics() {
        const todayStr = getTodayStr();
        const elapsedDiff = diffDaysStr(this.state.startDate, todayStr);
        const theoreticalCut = Math.max(0, Math.min(elapsedDiff, this.state.totalDays));

        const remaining = Math.max(0, this.state.totalDays - this.state.cutDays);
        const percent = Math.min(100, Math.round((this.state.cutDays / this.state.totalDays) * 100));

        const isDesc = this.state.numberingDirection === 'desc';
        const nextCutIndex = this.state.cutDays + 1;
        const nextDisplayNum = nextCutIndex <= this.state.totalDays ? this.getDisplayNumberForIndex(nextCutIndex) : null;

        return {
            remaining,
            percent,
            theoreticalCut,
            isFinished: remaining === 0,
            isDesc,
            nextCutIndex,
            nextDisplayNum
        };
    }

    renderAll() {
        const metrics = this.calculateMetrics();

        // Update header details
        this.dom.eventTitle.textContent = this.state.title;
        const targetDateObj = parseLocalDate(this.state.targetDate);
        const targetFormatted = targetDateObj.toLocaleDateString('cs-CZ', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });

        const numberingLabel = metrics.isDesc ? `${this.state.totalDays} → 1` : `1 → ${this.state.totalDays}`;
        this.dom.eventTargetDate.textContent = `Cílové datum: ${targetFormatted}`;
        this.dom.eventBadge.textContent = `Délka metru: ${this.state.totalDays} cm (${numberingLabel})`;

        // Stats
        this.dom.statCut.textContent = `${this.state.cutDays} cm`;
        this.dom.statRemaining.textContent = `${metrics.remaining} cm`;
        this.dom.statPercent.textContent = `${metrics.percent}%`;
        this.dom.progressBarFill.style.width = `${metrics.percent}%`;
        this.dom.progressText.textContent = `${this.state.cutDays} z ${this.state.totalDays} cm odstřiženo (${metrics.percent}%)`;

        // Update fast cut button label
        if (metrics.nextDisplayNum !== null) {
            this.dom.btnCutNext.innerHTML = `✂️ Ustřihnout další centimetr (č. ${metrics.nextDisplayNum})`;
            this.dom.btnCutNext.disabled = false;
        } else {
            this.dom.btnCutNext.innerHTML = `🏆 Celý metr je ustřižen!`;
            this.dom.btnCutNext.disabled = true;
        }

        // Render Tape
        this.renderTape();

        // Render Diary list
        this.renderDiary();

        // Sound icon update
        this.dom.btnSoundToggle.innerHTML = this.state.soundEnabled ? '🔊 Zvuk: Zapnut' : '🔇 Zvuk: Vypnut';
    }

    renderTape() {
        const container = this.dom.tapeContainer;
        container.innerHTML = '';

        // Start metal cap (kování na začátku metru)
        const cap = document.createElement('div');
        cap.className = 'tape-metal-cap-start';
        cap.innerHTML = `
            <div class="rivet"></div>
            <div class="rivet"></div>
            <div class="rivet"></div>
        `;
        container.appendChild(cap);

        const startDateObj = parseLocalDate(this.state.startDate);

        // Generate centimeter segments (from day index 1 to totalDays)
        for (let dayIndex = 1; dayIndex <= this.state.totalDays; dayIndex++) {
            const displayNum = this.getDisplayNumberForIndex(dayIndex);

            const seg = document.createElement('div');
            seg.className = 'tape-cm';
            seg.dataset.dayIndex = dayIndex;
            seg.dataset.displayNum = displayNum;

            const isCut = dayIndex <= this.state.cutDays;
            const isNextToCut = dayIndex === this.state.cutDays + 1;

            if (isCut) {
                seg.classList.add('is-cut');
            }
            if (isNextToCut) {
                seg.classList.add('is-today');
            }

            // Calculate date for this dayIndex
            const itemDate = new Date(startDateObj);
            itemDate.setDate(itemDate.getDate() + (dayIndex - 1));
            const dateStr = itemDate.toLocaleDateString('cs-CZ', { day: 'numeric', month: 'numeric' });

            // Check milestone (match either display number or dayIndex)
            const milestone = this.state.milestones.find(m => m.day === displayNum || m.day === dayIndex);
            let milestoneHtml = '';
            if (milestone) {
                milestoneHtml = `
                    <div class="milestone-pin" title="${milestone.label}">
                        ${milestone.icon} ${milestone.label}
                    </div>
                `;
            }

            // Scissor action button on item
            let actionBtnHtml = '';
            if (!isCut) {
                actionBtnHtml = `
                    <button class="scissor-cut-btn" title="Ustřihnout centimetr č. ${displayNum}" data-day-index="${dayIndex}">
                        ✂️
                    </button>
                `;
            }

            seg.innerHTML = `
                ${milestoneHtml}
                <!-- Top ticks -->
                <div class="mm-ticks">
                    <div class="tick tick-mm"></div>
                    <div class="tick tick-mm"></div>
                    <div class="tick tick-half"></div>
                    <div class="tick tick-mm"></div>
                    <div class="tick tick-mm"></div>
                </div>

                <div class="cm-number-wrap">
                    <span class="cm-number">${displayNum}</span>
                    <span class="cm-date">${dateStr}</span>
                </div>

                <!-- Bottom ticks -->
                <div class="mm-ticks tick-bottom">
                    <div class="tick tick-mm"></div>
                    <div class="tick tick-mm"></div>
                    <div class="tick tick-half"></div>
                    <div class="tick tick-mm"></div>
                    <div class="tick tick-mm"></div>
                </div>
                ${actionBtnHtml}
            `;

            // Scissor click handler
            const cutBtn = seg.querySelector('.scissor-cut-btn');
            if (cutBtn) {
                cutBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.cutSpecificDay(dayIndex, e);
                });
            }

            container.appendChild(seg);
        }

        // Auto-scroll tape towards the current cutting position
        setTimeout(() => {
            const activeElem = container.querySelector('.is-today') || container.querySelector('.tape-cm:not(.is-cut)');
            if (activeElem) {
                const offset = activeElem.offsetLeft - this.dom.tapeScrollArea.clientWidth / 2 + 32;
                this.dom.tapeScrollArea.scrollTo({ left: Math.max(0, offset), behavior: 'smooth' });
            }
        }, 150);
    }

    renderDiary() {
        const container = this.dom.diaryList;
        if (!this.state.diary || this.state.diary.length === 0) {
            container.innerHTML = `<div style="color: var(--text-muted); font-size: 0.85rem; padding: 0.5rem;">Zatím žádné záznamy. Při ustřižení dne si můžete zapsat vzpomínku! 📝</div>`;
            return;
        }

        container.innerHTML = this.state.diary.map(entry => `
            <div class="diary-item">
                <div class="diary-day">${entry.day}. cm</div>
                <div class="diary-text">${this.escapeHtml(entry.text)}</div>
                <div class="diary-date">${entry.date}</div>
            </div>
        `).join('');
    }

    cutNextDay(e) {
        if (this.state.cutDays >= this.state.totalDays) {
            this.showToast('Celý metr je již ustřižen! 🎉 Vítej v cíli!');
            window.soundFx.playCelebration();
            this.triggerCelebrationParticles();
            return;
        }

        const nextDayIndex = this.state.cutDays + 1;
        this.cutSpecificDay(nextDayIndex, e);
    }

    cutSpecificDay(targetDayIndex, event) {
        if (targetDayIndex <= this.state.cutDays) return;

        const displayNum = this.getDisplayNumberForIndex(targetDayIndex);

        // Perform sound & visual effects
        window.soundFx.playSnip();

        // Get coordinates for visual cut piece
        let x = window.innerWidth / 2;
        let y = window.innerHeight / 2;
        if (event && event.clientX) {
            x = event.clientX;
            y = event.clientY;
        }

        this.spawnCutRibbonPiece(x, y, displayNum);
        this.spawnSparks(x, y);

        // Update state
        this.state.cutDays = targetDayIndex;
        this.saveState();
        this.renderAll();

        // Check if this was a milestone
        const hitMilestone = this.state.milestones.find(m => m.day === displayNum || m.day === targetDayIndex);
        if (hitMilestone) {
            window.soundFx.playMilestoneBell();
            this.triggerCelebrationParticles(60);
            this.showToast(`🎉 Dosažen milník: ${hitMilestone.icon} ${hitMilestone.label}!`);
        }

        // Check if 100% finished
        if (this.state.cutDays >= this.state.totalDays) {
            window.soundFx.playCelebration();
            this.triggerCelebrationParticles(150);
            this.showToast('🏆 BLAHOPŘEJEME! Celý metr je ustřižen! Užij si svobodu a cíl!');
        } else {
            // Prompt for optional diary note
            this.promptDiaryNote(displayNum);
        }
    }

    syncWithToday() {
        const metrics = this.calculateMetrics();
        if (metrics.theoreticalCut > this.state.cutDays) {
            const toCut = metrics.theoreticalCut;
            this.state.cutDays = toCut;
            this.saveState();
            this.renderAll();
            window.soundFx.playSnip();
            this.triggerCelebrationParticles(40);
            const currentNum = this.getDisplayNumberForIndex(toCut);
            this.showToast(`Metr synchronizován s dnešním dnem (ustřiženo po centimetr č. ${currentNum})!`);
        } else {
            this.showToast('Metr je již plně synchronizován s dnešním dnem! 👍');
        }
    }

    promptDiaryNote(displayNum) {
        this.currentDiaryDay = displayNum;
        this.dom.currentCutDayLabel.textContent = `${displayNum}. centimetr`;
        this.dom.diaryNoteText.value = '';
        this.dom.diaryModal.classList.add('active');
    }

    saveDiaryNote() {
        const text = this.dom.diaryNoteText.value.trim();
        if (text && this.currentDiaryDay !== undefined) {
            if (!this.state.diary) this.state.diary = [];
            this.state.diary.unshift({
                day: this.currentDiaryDay,
                text: text,
                date: new Date().toLocaleDateString('cs-CZ')
            });
            this.saveState();
            this.renderDiary();
            this.showToast('Vzpomínka uložena do deníku 📝');
        }
        this.closeAllModals();
    }

    spawnCutRibbonPiece(x, y, displayNum) {
        const piece = document.createElement('div');
        piece.className = 'falling-tape-piece';
        piece.style.left = `${x - 30}px`;
        piece.style.top = `${y - 40}px`;
        piece.style.width = '60px';
        piece.style.height = '100px';
        piece.style.background = getComputedStyle(document.body).getPropertyValue('--tape-bg-grad') || '#e6b83b';
        piece.style.border = '2px solid #333';
        piece.style.display = 'flex';
        piece.style.alignItems = 'center';
        piece.style.justifyContent = 'center';
        piece.style.fontFamily = 'monospace';
        piece.style.fontWeight = '900';
        piece.style.color = '#111';
        piece.style.fontSize = '1.4rem';
        piece.innerHTML = `✂️ ${displayNum}`;

        document.body.appendChild(piece);
        setTimeout(() => piece.remove(), 1300);
    }

    spawnSparks(x, y) {
        for (let i = 0; i < 20; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = 2 + Math.random() * 6;
            this.particles.push({
                x: x,
                y: y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed - 2,
                size: 3 + Math.random() * 4,
                color: Math.random() > 0.5 ? '#e3b341' : '#f85149',
                alpha: 1,
                decay: 0.03 + Math.random() * 0.03,
                rotation: Math.random() * 360,
                vRot: (Math.random() - 0.5) * 10
            });
        }
    }

    triggerCelebrationParticles(count = 100) {
        for (let i = 0; i < count; i++) {
            const colors = ['#e3b341', '#58a6ff', '#3fb950', '#f85149', '#ec4899', '#a855f7'];
            this.particles.push({
                x: Math.random() * window.innerWidth,
                y: -20,
                vx: (Math.random() - 0.5) * 4,
                vy: 3 + Math.random() * 6,
                size: 6 + Math.random() * 8,
                color: colors[Math.floor(Math.random() * colors.length)],
                alpha: 1,
                decay: 0.008 + Math.random() * 0.008,
                rotation: Math.random() * 360,
                vRot: (Math.random() - 0.5) * 15
            });
        }
    }

    renderParticles() {
        this.ctx.clearRect(0, 0, this.dom.fxCanvas.width, this.dom.fxCanvas.height);

        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            p.x += p.vx;
            p.y += p.vy;
            p.vy += 0.15; // gravity
            p.alpha -= p.decay;
            p.rotation += p.vRot;

            if (p.alpha <= 0 || p.y > window.innerHeight) {
                this.particles.splice(i, 1);
                continue;
            }

            this.ctx.save();
            this.ctx.globalAlpha = p.alpha;
            this.ctx.translate(p.x, p.y);
            this.ctx.rotate((p.rotation * Math.PI) / 180);
            this.ctx.fillStyle = p.color;
            this.ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
            this.ctx.restore();
        }

        requestAnimationFrame(() => this.renderParticles());
    }

    shareProgress() {
        const metrics = this.calculateMetrics();
        const numberingLabel = metrics.isDesc ? 'od 100 do 1' : 'od 1 do 100';
        const text = `✂️ Můj metr: "${this.state.title}" (${numberingLabel})\nUstřiženo: ${this.state.cutDays}/${this.state.totalDays} cm (${metrics.percent}% hotovo)\nZbývá: ${metrics.remaining} cm (dní) do cíle! 🚀`;

        if (navigator.clipboard) {
            navigator.clipboard.writeText(text).then(() => {
                this.showToast('📋 Souhrn byl zkopírován do schránky!');
            }).catch(() => {
                alert(text);
            });
        } else {
            alert(text);
        }
    }

    showToast(msg) {
        const toast = document.createElement('div');
        toast.className = 'toast';
        toast.innerHTML = `<span>✂️</span> <span>${msg}</span>`;
        this.dom.toastContainer.appendChild(toast);
        setTimeout(() => {
            toast.style.opacity = '0';
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// Start application when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.meterApp = new MeterApp();
});
