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

// --- 3. ฟังก์ชันนับเวลาฝึก (ปรับจาก 10 เป็น 30-60 วินาทีตามต้องการ) ---
// ผมตั้งค่าเริ่มต้นไว้ที่ 30 วินาทีตามคำแนะนำขั้นต่ำครับ
function runPhase(name, seconds) {
    return new Promise((resolve) => {
        let timeLeft = seconds;
        document.getElementById("currentActionText").innerText = name;
        
        const interval = setInterval(() => {
            document.getElementById("timerDisplay").innerText = timeLeft;
            // ปรับแถบสถานะให้คำนวณตามจำนวนวินาทีที่ตั้งไว้จริง
            document.getElementById("timerBar").style.width = (timeLeft / seconds) * 100 + "%";
            
            if (timeLeft <= 0) {
                clearInterval(interval);
                resolve(Math.abs(currentAngle));
            }
            timeLeft--;
        }, 1000);
    });
}

// --- 4. ฟังก์ชันเริ่มการฝึก (ปรับเป็น 3 เซ็ต เซ็ตละ 30 วินาที) ---
document.getElementById("startBtn").onclick = async () => {
    if (isRunning) return;
    isRunning = true;
    document.getElementById("startBtn").disabled = true;
    document.getElementById("startBtn").innerText = "กำลังฝึก...";

    // ปรับ i <= 3 สำหรับ 3 เซ็ต (หรือเปลี่ยนเป็น 5 ตามชอบ)
    for (let i = 1; i <= 3; i++) {
        document.getElementById("setCountDisplay").innerText = `${i} / 3`;
        
        // ปรับเลข 30 เป็น 60 ได้ตามความต้องการ (หน่วยเป็นวินาที)
        const dVal = await runPhase("ยกปลายเท้า (Dorsi)", 30); 
        const pVal = await runPhase("เหยียดปลายเท้า (Plantar)", 30);
        
        const dorsiFinal = dVal.toFixed(1);
        const plantarFinal = pVal.toFixed(1);
        const romFinal = (parseFloat(dorsiFinal) + parseFloat(plantarFinal)).toFixed(1);
        
        await set(ref(db, 'history/' + i), {
            set: i, 
            dorsi: dorsiFinal, 
            plantar: plantarFinal, 
            rom: romFinal
        });
    }

    document.getElementById("currentActionText").innerText = "การฝึกเสร็จสมบูรณ์!";
    document.getElementById("startBtn").disabled = false;
    document.getElementById("startBtn").innerText = "เริ่มฝึกใหม่อีกครั้ง";
    isRunning = false;
};