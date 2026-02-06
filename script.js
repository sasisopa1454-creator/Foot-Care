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

// 1. รับค่าองศาจาก ESP32 แบบ Realtime
onValue(ref(db, 'live/angleX'), (snapshot) => {
    currentAngle = snapshot.val() || 0;
    
    // บังคับให้แสดงผลทศนิยม 1 ตำแหน่งด้วย .toFixed(1)
    if (currentAngle >= 0) {
        document.getElementById("liveDorsi").innerText = currentAngle.toFixed(1);
        document.getElementById("livePlantar").innerText = "0.0"; 
    } else {
        document.getElementById("liveDorsi").innerText = "0.0";
        document.getElementById("livePlantar").innerText = Math.abs(currentAngle).toFixed(1);
    }
});

// 2. ฟังก์ชันนับเวลา 10 วินาที
function runPhase(name, seconds) {
    return new Promise((resolve) => {
        let timeLeft = seconds;
        document.getElementById("currentActionText").innerText = name;
        const interval = setInterval(() => {
            document.getElementById("timerDisplay").innerText = timeLeft;
            document.getElementById("timerBar").style.width = (timeLeft / 10) * 100 + "%";
            if (timeLeft <= 0) {
                clearInterval(interval);
                resolve(Math.abs(currentAngle));
            }
            timeLeft--;
        }, 1000);
    });
}

// 3. เริ่มฝึก 5 เซ็ต
document.getElementById("startBtn").onclick = async () => {
    if (isRunning) return;
    isRunning = true;
    document.getElementById("startBtn").disabled = true;
    document.getElementById("startBtn").innerText = "กำลังฝึก...";

    for (let i = 1; i <= 5; i++) {
        document.getElementById("setCountDisplay").innerText = `${i} / 5`;
        
        const dVal = await runPhase("ยกปลายเท้า (Dorsi)", 10);
        const pVal = await runPhase("เหยียดปลายเท้า (Plantar)", 10);
        
        const rom = (dVal + pVal).toFixed(1);
        
        // บันทึกเข้า Firebase ประวัติ
        set(ref(db, 'history/' + i), {
            set: i, 
            dorsi: dVal.toFixed(1), 
            plantar: pVal.toFixed(1), 
            rom: rom
        });
    }
    document.getElementById("currentActionText").innerText = "การฝึกเสร็จสมบูรณ์!";
    document.getElementById("startBtn").disabled = false;
    document.getElementById("startBtn").innerText = "เริ่มฝึกใหม่อีกครั้ง";
    isRunning = false;
};

// 4. แสดงผลตาราง Realtime
onValue(ref(db, 'history'), (snapshot) => {
    const data = snapshot.val();
    const tbody = document.getElementById("exerciseTableBody");
    tbody.innerHTML = "";
    if (data) {
        // เรียงลำดับเซ็ตให้ถูกต้องก่อนแสดงผล
        Object.values(data).sort((a, b) => a.set - b.set).forEach(row => {
            tbody.innerHTML += `<tr>
                <td>${row.set}</td>
                <td>${row.dorsi}</td>
                <td>${row.plantar}</td>
                <td>${row.rom}</td>
            </tr>`;
        });
    }
});