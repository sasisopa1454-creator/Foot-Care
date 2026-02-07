import { initializeApp } from "https://www.gstatic.com/firebasejs/9.17.1/firebase-app.js";
import { getDatabase, ref, onValue, set } from "https://www.gstatic.com/firebasejs/9.17.1/firebase-database.js";

// --- 1. Firebase Config (อย่าลืมใส่ Key ของคุณนะครับ) ---
const firebaseConfig = {
    apiKey: "ใส่_API_KEY_ของคุณที่นี่", 
    databaseURL: "https://foot-care-15028-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "foot-care-15028",
    appId: "ใส่_APP_ID_ของคุณที่นี่" 
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

let currentAngle = 0;
let isRunning = false;
let timeCount = 0; 
let exerciseChart;
let historyData = { dorsi: [], plantar: [], rom: [] };

// --- 2. ฟังก์ชันเริ่มทำงานเมื่อโหลดหน้าเว็บเสร็จ ---
window.onload = () => {
    initChart();
    setupEventListeners();
};

function initChart() {
    const canvas = document.getElementById('exerciseChart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    
    exerciseChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: [],
            datasets: [{
                label: 'องศาปัจจุบัน (Live)',
                data: [],
                borderColor: '#8e44ad',
                backgroundColor: 'rgba(142, 68, 173, 0.1)',
                borderWidth: 2,
                pointRadius: 0,
                fill: true,
                tension: 0.4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: false,
            scales: {
                y: { min: -70, max: 70, title: { display: true, text: 'องศา (°)' } },
                x: { title: { display: true, text: 'เวลา (วินาที)' } }
            }
        }
    });
}

// --- 3. รับค่า Realtime จาก Sensor ---
onValue(ref(db, 'live/angleX'), (snapshot) => {
    currentAngle = parseFloat(snapshot.val() || 0);
    
    // อัปเดตตัวเลขสด
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

    // กราฟยึกยือ
    if (isRunning && exerciseChart) {
        timeCount++;
        exerciseChart.data.labels.push(timeCount);
        exerciseChart.data.datasets[0].data.push(currentAngle);
        
        if (exerciseChart.data.labels.length > 100) {
            exerciseChart.data.labels.shift();
            exerciseChart.data.datasets[0].data.shift();
        }
        exerciseChart.update('none');
    }
});

// --- 4. ฟังก์ชันนับเวลาฝึก และ "คำนวณค่าเฉลี่ย" ---
function runPhase(name, seconds) {
    return new Promise((resolve) => {
        let timeLeft = seconds;
        let collectedValues = [];
        document.getElementById("currentActionText").innerText = name;
        
        const interval = setInterval(() => {
            document.getElementById("timerDisplay").innerText = timeLeft;
            document.getElementById("timerBar").style.width = (timeLeft / seconds) * 100 + "%";
            
            collectedValues.push(Math.abs(currentAngle));
            
            if (timeLeft <= 0) {
                clearInterval(interval);
                const avg = collectedValues.reduce((a, b) => a + b, 0) / collectedValues.length;
                resolve(avg);
            }
            timeLeft--;
        }, 1000);
    });
}

// --- 5. ตั้งค่าปุ่มกดต่างๆ ---
function setupEventListeners() {
    const startBtn = document.getElementById("startBtn");
    const viewResultBtn = document.getElementById("viewResultBtn");

    if (startBtn) {
        startBtn.onclick = async () => {
            if (isRunning) return;

            // Reset
            await set(ref(db, 'history'), null);
            exerciseChart.data.labels = [];
            exerciseChart.data.datasets[0].data = [];
            timeCount = 0;
            historyData = { dorsi: [], plantar: [], rom: [] };
            exerciseChart.update();
            document.getElementById("summarySection").style.display = "none";

            isRunning = true;
            startBtn.disabled = true;
            startBtn.innerText = "กำลังฝึก...";

            for (let i = 1; i <= 5; i++) {
                document.getElementById("setCountDisplay").innerText = `${i} / 5`;
                
                const avgDorsi = await runPhase("ยกปลายเท้า (Dorsi)", 30); 
                const avgPlantar = await runPhase("เหยียดปลายเท้า (Plantar)", 30);
                
                const dStr = avgDorsi.toFixed(1);
                const pStr = avgPlantar.toFixed(1);
                const romStr = (avgDorsi + avgPlantar).toFixed(1);

                historyData.dorsi.push(avgDorsi);
                historyData.plantar.push(avgPlantar);
                historyData.rom.push(avgDorsi + avgPlantar);
                
                await set(ref(db, 'history/' + i), {
                    set: i, 
                    dorsi: dStr, 
                    plantar: pStr, 
                    rom: romStr
                });
            }

            document.getElementById("currentActionText").innerText = "การฝึกเสร็จสมบูรณ์!";
            startBtn.disabled = false;
            startBtn.innerText = "เริ่มฝึกใหม่อีกครั้ง";
            document.getElementById("summarySection").style.display = "block";
            isRunning = false;
        };
    }

    if (viewResultBtn) {
        viewResultBtn.onclick = () => {
            const maxD = Math.max(...historyData.dorsi);
            const maxP = Math.max(...historyData.plantar);
            const maxR = Math.max(...historyData.rom);

            let res = `<b>สรุปค่าเฉลี่ยที่ดีที่สุดจาก 5 เซ็ต</b><br>`;
            res += `Dorsi: ${maxD.toFixed(1)}° ${maxD >= 20 ? "✅ ปกติ" : "❌ ต่ำกว่าเกณฑ์(≥20°)"}<br>`;
            res += `Plantar: ${maxP.toFixed(1)}° ${maxP >= 50 ? "✅ ปกติ" : "❌ ต่ำกว่าเกณฑ์(≥50°)"}<br>`;
            res += `ROM: ${maxR.toFixed(1)}° ${maxR >= 70 ? "✅ ปกติ" : "❌ ต่ำกว่าเกณฑ์(≥70°)"}`;

            const evalRes = document.getElementById("evaluationResult");
            evalRes.innerHTML = res;
            evalRes.style.backgroundColor = (maxR >= 70) ? "#e8f5e9" : "#ffebee";
        };
    }
}

// --- 6. แสดงตาราง ---
onValue(ref(db, 'history'), (snapshot) => {
    const data = snapshot.val();
    const tbody = document.getElementById("exerciseTableBody");
    if (tbody && data) {
        tbody.innerHTML = "";
        Object.values(data).sort((a, b) => a.set - b.set).forEach(row => {
            tbody.innerHTML += `<tr><td>${row.set}</td><td>${row.dorsi}</td><td>${row.plantar}</td><td>${row.rom}</td></tr>`;
        });
    }
});