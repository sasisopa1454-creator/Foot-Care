import { initializeApp } from "https://www.gstatic.com/firebasejs/9.17.1/firebase-app.js";
import { getDatabase, ref, onValue, set } from "https://www.gstatic.com/firebasejs/9.17.1/firebase-database.js";

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
let timeCount = 0; // ตัวนับเวลาสำหรับแกน X ของกราฟ

// --- 2. ตั้งค่า Chart.js (กราฟยึกยือ Real-time) ---
let exerciseChart;
let chartData = {
    labels: [], // แกน X จะเป็นวินาทีที่เพิ่มขึ้นเรื่อยๆ
    datasets: [{
        label: 'องศาปัจจุบัน (Live)',
        data: [],
        borderColor: '#8e44ad',
        backgroundColor: 'rgba(142, 68, 173, 0.1)',
        borderWidth: 2,
        pointRadius: 0, // ไม่แสดงจุดเพื่อให้เส้นดูสมูท
        fill: true,
        tension: 0.4
    }]
};

function initChart() {
    const ctx = document.getElementById('exerciseChart').getContext('2d');
    exerciseChart = new Chart(ctx, {
        type: 'line',
        data: chartData,
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: false, // ปิด animation เพื่อให้กราฟไหลลื่นแบบ Real-time
            scales: {
                y: { min: -70, max: 70, title: { display: true, text: 'องศา (°)' } },
                x: { title: { display: true, text: 'เวลา (วินาที)' } }
            }
        }
    });
}
initChart();

// --- 3. รับค่า Realtime จาก Sensor ---
onValue(ref(db, 'live/angleX'), (snapshot) => {
    currentAngle = parseFloat(snapshot.val() || 0);
    
    // อัปเดตตัวเลขสดบนหน้าจอ
    if (currentAngle >= 0) {
        document.getElementById("liveDorsi").innerText = currentAngle.toFixed(1);
        document.getElementById("livePlantar").innerText = "0.0"; 
    } else {
        document.getElementById("liveDorsi").innerText = "0.0";
        document.getElementById("livePlantar").innerText = Math.abs(currentAngle).toFixed(1);
    }

    // ถ้ากำลังฝึกอยู่ ให้กราฟ "ยึกยือ" ตามค่าปัจจุบันทันที
    if (isRunning) {
        timeCount++;
        chartData.labels.push(timeCount);
        chartData.datasets[0].data.push(currentAngle);
        
        // จำกัดให้กราฟโชว์แค่ 100 จุดล่าสุดเพื่อให้ไม่หน่วง (Optional)
        if (chartData.labels.length > 100) {
            chartData.labels.shift();
            chartData.datasets[0].data.shift();
        }
        exerciseChart.update('none'); // update แบบไม่ใช้ animation
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
            
            // เก็บค่าสัมบูรณ์เพื่อหาค่าเฉลี่ยความกว้างของการเคลื่อนไหว
            collectedValues.push(Math.abs(currentAngle));
            
            if (timeLeft <= 0) {
                clearInterval(interval);
                const sum = collectedValues.reduce((a, b) => a + b, 0);
                resolve(sum / collectedValues.length);
            }
            timeLeft--;
        }, 1000);
    });
}

// --- 5. ฟังก์ชันเริ่มการฝึก (5 เซ็ต) ---
// ตัวแปรเก็บค่าสูงสุดของค่าเฉลี่ยเพื่อเอาไว้ประเมินตอนจบ
let historyData = { dorsi: [], plantar: [], rom: [] };

document.getElementById("startBtn").onclick = async () => {
    if (isRunning) return;

    // Reset ทุกอย่าง
    await set(ref(db, 'history'), null);
    chartData.labels = [];
    chartData.datasets[0].data = [];
    timeCount = 0;
    historyData = { dorsi: [], plantar: [], rom: [] };
    exerciseChart.update();
    document.getElementById("summarySection").style.display = "none";

    isRunning = true;
    document.getElementById("startBtn").disabled = true;
    document.getElementById("startBtn").innerText = "กำลังฝึก...";

    for (let i = 1; i <= 5; i++) {
        document.getElementById("setCountDisplay").innerText = `${i} / 5`;
        
        const avgDorsi = await runPhase("ยกปลายเท้า (Dorsi)", 30); 
        const avgPlantar = await runPhase("เหยียดปลายเท้า (Plantar)", 30);
        
        const dStr = avgDorsi.toFixed(1);
        const pStr = avgPlantar.toFixed(1);
        const romStr = (avgDorsi + avgPlantar).toFixed(1);

        // เก็บค่าลงตัวแปรไว้ประเมินผล
        historyData.dorsi.push(avgDorsi);
        historyData.plantar.push(avgPlantar);
        historyData.rom.push(avgDorsi + avgPlantar);
        
        // บันทึกค่าเฉลี่ยลงตาราง (Firebase)
        await set(ref(db, 'history/' + i), {
            set: i, 
            dorsi: dStr, 
            plantar: pStr, 
            rom: romStr
        });
    }

    document.getElementById("currentActionText").innerText = "การฝึกเสร็จสมบูรณ์!";
    document.getElementById("startBtn").disabled = false;
    document.getElementById("startBtn").innerText = "เริ่มฝึกใหม่อีกครั้ง";
    document.getElementById("summarySection").style.display = "block";
    isRunning = false;
};

// --- 6. ปุ่มประเมินผล (20/50/70) ---
document.getElementById("viewResultBtn").onclick = () => {
    const maxD = Math.max(...historyData.dorsi);
    const maxP = Math.max(...historyData.plantar);
    const maxR = Math.max(...historyData.rom);

    let res = `<b>สรุปค่าเฉลี่ยที่ดีที่สุดจาก 5 เซ็ต</b><br>`;
    res += `Dorsi: ${maxD.toFixed(1)}° ${maxD >= 20 ? "✅ ปกติ" : "❌ ต่ำกว่าเกณฑ์(เป้าหมาย ≥ 20°)"}<br>`;
    res += `Plantar: ${maxP.toFixed(1)}° ${maxP >= 50 ? "✅ ปกติ" : "❌ ต่ำกว่าเกณฑ์(เป้าหมาย ≥ 50°)"}<br>`;
    res += `ROM: ${maxR.toFixed(1)}° ${maxR >= 70 ? "✅ ปกติ" : "❌ ต่ำกว่าเกณฑ์(เป้าหมาย ≥ 70°)"}`;

    document.getElementById("evaluationResult").innerHTML = res;
    document.getElementById("evaluationResult").style.backgroundColor = (maxR >= 70) ? "#e8f5e9" : "#ffebee";
};

// --- 7. แสดงตาราง ---
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