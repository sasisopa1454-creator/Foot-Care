// ===============================
// 1. Firebase SDK (ใช้ชุดเดียว)
// ===============================
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.17.1/firebase-app.js";
import { getDatabase, ref, onValue, set } from "https://www.gstatic.com/firebasejs/9.17.1/firebase-database.js";

// ===============================
// 2. Firebase Config
// ===============================
const firebaseConfig = {
  apiKey: "AIzaSyArB39e1jNG71QNBrSDGoXzQk7o4HE9SfM",
  databaseURL: "https://foot-care-15028-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "foot-care-15028",
  appId: "1:568507097776:web:5ecd08c79da53ed42f1175"
};

// init
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// ===============================
// 3. ตัวแปรหลัก
// ===============================
let currentAngle = 0;
let isRunning = false;
let timeCount = 0;
let exerciseChart;
let historyData = { dorsi: [], plantar: [], rom: [] };

// ===============================
// 4. โหลดหน้าเว็บ
// ===============================
window.onload = () => {
  initChart();
  setupEventListeners();
};

// ===============================
// 5. สร้างกราฟ
// ===============================
function initChart() {
  const canvas = document.getElementById("exerciseChart");
  if (!canvas) return;

  const ctx = canvas.getContext("2d");
  exerciseChart = new Chart(ctx, {
    type: "line",
    data: {
      labels: [],
      datasets: [{
        label: "องศาปัจจุบัน (Live)",
        data: [],
        borderWidth: 2,
        pointRadius: 0,
        tension: 0.4
      }]
    },
    options: {
      animation: false,
      responsive: true,
      scales: {
        y: { min: -70, max: 70 },
        x: { title: { display: true, text: "เวลา (วินาที)" } }
      }
    }
  });
}

// ===============================
// 6. รับค่า Realtime จาก Firebase
// ===============================
onValue(ref(db, "live/angleX"), (snapshot) => {
  console.log("Firebase angleX =", snapshot.val()); // 🔍 LOG สำคัญ

  currentAngle = parseFloat(snapshot.val() || 0);

  const liveDorsi = document.getElementById("liveDorsi");
  const livePlantar = document.getElementById("livePlantar");

  if (liveDorsi && livePlantar) {
    if (currentAngle >= 0) {
      liveDorsi.innerText = currentAngle.toFixed(1);
      livePlantar.innerText = "0.0";
    } else {
      liveDorsi.innerText = "0.0";
      livePlantar.innerText = Math.abs(currentAngle).toFixed(1);
    }
  }

  if (isRunning && exerciseChart) {
    timeCount++;
    exerciseChart.data.labels.push(timeCount);
    exerciseChart.data.datasets[0].data.push(currentAngle);

    if (exerciseChart.data.labels.length > 100) {
      exerciseChart.data.labels.shift();
      exerciseChart.data.datasets[0].data.shift();
    }
    exerciseChart.update("none");
  }
});

// ===============================
// 7. ฟังก์ชันจับค่าเฉลี่ย
// ===============================
function runPhase(name, seconds) {
  return new Promise((resolve) => {
    let timeLeft = seconds;
    let values = [];

    document.getElementById("currentActionText").innerText = name;

    const interval = setInterval(() => {
      document.getElementById("timerDisplay").innerText = timeLeft;
      document.getElementById("timerBar").style.width =
        (timeLeft / seconds) * 100 + "%";

      values.push(Math.abs(currentAngle));

      if (timeLeft <= 0) {
        clearInterval(interval);
        const avg =
          values.reduce((a, b) => a + b, 0) / values.length;
        resolve(avg);
      }
      timeLeft--;
    }, 1000);
  });
}

// ===============================
// 8. ปุ่มควบคุม
// ===============================
function setupEventListeners() {
  const startBtn = document.getElementById("startBtn");
  const viewResultBtn = document.getElementById("viewResultBtn");

  if (startBtn) {
    startBtn.onclick = async () => {
      if (isRunning) return;

      await set(ref(db, "history"), null);
      historyData = { dorsi: [], plantar: [], rom: [] };
      timeCount = 0;

      exerciseChart.data.labels = [];
      exerciseChart.data.datasets[0].data = [];
      exerciseChart.update();

      isRunning = true;
      startBtn.disabled = true;

      for (let i = 1; i <= 5; i++) {
        document.getElementById("setCountDisplay").innerText = `${i}/5`;

        const d = await runPhase("ยกปลายเท้า (Dorsi)", 30);
        const p = await runPhase("เหยียดปลายเท้า (Plantar)", 30);

        historyData.dorsi.push(d);
        historyData.plantar.push(p);
        historyData.rom.push(d + p);

        await set(ref(db, "history/" + i), {
          set: i,
          dorsi: d.toFixed(1),
          plantar: p.toFixed(1),
          rom: (d + p).toFixed(1)
        });
      }

      isRunning = false;
      startBtn.disabled = false;
      document.getElementById("summarySection").style.display = "block";
    };
  }

  if (viewResultBtn) {
    viewResultBtn.onclick = () => {
      const maxD = Math.max(...historyData.dorsi);
      const maxP = Math.max(...historyData.plantar);
      const maxR = Math.max(...historyData.rom);

      document.getElementById("evaluationResult").innerHTML = `
        Dorsi: ${maxD.toFixed(1)}°<br>
        Plantar: ${maxP.toFixed(1)}°<br>
        ROM: ${maxR.toFixed(1)}°
      `;
    };
  }
}

// ===============================
// 9. ตาราง History
// ===============================
onValue(ref(db, "history"), (snapshot) => {
  const data = snapshot.val();
  const tbody = document.getElementById("exerciseTableBody");
  if (!tbody || !data) return;

  tbody.innerHTML = "";
  Object.values(data).forEach((r) => {
    tbody.innerHTML += `
      <tr>
        <td>${r.set}</td>
        <td>${r.dorsi}</td>
        <td>${r.plantar}</td>
        <td>${r.rom}</td>
      </tr>`;
  });
});

