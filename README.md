# Cadence Clock — Daily Schedule & Interval Alarm Notifier

A clean, **mobile clock-app-inspired** daily schedule notifier that triggers push notifications and synthesized alarm tones strictly according to your **clock times** and **repeat timer intervals**.

---

## Key Features

1. **Clock-Driven Schedule & Interval Timer**
   - **Live Digital Clock & Countdown Ring**: Displays the current time (`HH:mm:ss`) alongside a visual progress ring counting down to your next scheduled notification.
   - **Exact Start-Time Ringing**: Automatically triggers an alarm notification as soon as the live clock matches any active task's scheduled start time (`HH:mm`).
   - **One-Tap Repeat Intervals**: Switch your repeat reminder interval between **Every 1m**, **Every 5m**, **Every 15m**, **Every 30m**, or **Every 60m** (or configure any custom minute interval from 1 to 480 minutes).

2. **6 Built-In Synthesized Notification Tones**
   - Powered by the browser's Web Audio API (zero external audio dependencies):
     1. **Classic Digital Alarm**: Crisp four-pulse bedside clock beep pattern.
     2. **Morning Crystal Chime**: Bright ascending five-note harmonic arpeggio.
     3. **Warm Marimba**: Percussive wooden melodic sequence.
     4. **Radar Beacon**: Modern smartphone dual-tone wake sweep.
     5. **Tibetan Zen Bowl**: Deep resonant harmonic singing bowl chime.
     6. **Twin Bell Ringer**: Energetic alternating desk clock bell ring.
   - Choose a global tone or assign a custom notification tone to individual clock alarms, with instant **Test Tone** preview buttons.

3. **Phone Alarm-Style Schedule Cards**
   - Ordered chronologically by clock time (`08:00`, `09:30`, `11:30`, `14:00`, etc.).
   - Each card includes a large digital time display, tactile **ON / OFF** alarm switch, individual tone picker, **Ring Now** test button, and **Done** completion toggle.

---

## Getting Started

### 1. Install Dependencies
```bash
npm install
```

### 2. Run the Development Server
```bash
npm run dev
```
Open `http://localhost:3000` in your browser.

### 3. Run Unit Tests
```bash
node --test src/utils/schedulerLogic.test.ts
```

### 4. Build for Production
```bash
npm run build
```
