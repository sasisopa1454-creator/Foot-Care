import { initializeApp } from "https://www.gstatic.com/firebasejs/9.17.1/firebase-app.js";
import { getDatabase, ref, onValue, set } from "https://www.gstatic.com/firebasejs/9.17.1/firebase-database.js";

// --- 1. ตั้งค่า Firebase ---
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

// --- 2. รับค่าองศา Realtime (ทศนิยม 1 ตำแหน่ง) ---
onValue(ref(db, 'live/angleX'), (snapshot) => {
    currentAngle = snapshot.val() || 0;
    
    if (currentAngle >= 0) {
        document.getElementById("liveDorsi").innerText = currentAngle.toFixed(1);
        document.getElementById("livePlantar").innerText = "0.0"; 
    } else {
        document.getElementById("liveDorsi").innerText = "0.0";
        document.getElementById("livePlantar").innerText = Math.abs(currentAngle).toFixed(1);
    }
});

// --- 3. ฟังก์ชันนับเวลาฝึก (รองรับการปรับวินาที) ---
function runPhase(name, seconds) {
    return new Promise((resolve) => {
        let timeLeft = seconds;
        document.getElementById("currentActionText").innerText = name;
        const interval = setInterval(() => {
            document.getElementById("timerDisplay").innerText = timeLeft;
            // ปรับแถบสถานะตามเวลาที่ตั้งจริง
            document.getElementById("timerBar").style.width = (timeLeft / seconds) * 100 + "%";
            if (timeLeft <= 0) {
                clearInterval(interval);
                resolve(Math.abs(currentAngle));
            }
            timeLeft--;
        }, 1000);
    });
}

// --- 4. ฟังก์ชันเริ่มการฝึก (3 เซ็ต เซ็ตละ 30 วินาที) ---
document.getElementById("startBtn").onclick = async () => {
    if (isRunning) return;
    isRunning = true;
    document.getElementById("startBtn").disabled = true;
    document.getElementById("startBtn").innerText = "กำลังฝึก...";

    // ฝึกทั้งหมด 3 เซ็ต
    for (let i = 1; i <= 3; i++) {
        document.getElementById("setCountDisplay").innerText = `${i} / 3`;
        
        // ท่าละ 30 วินาทีตามคำแนะนำ
        const dVal = await runPhase("ยกปลายเท้า (Dorsi)", 30); 
        const pVal = await runPhase("เหยียดปลายเท้า (Plantar)", 30);
        
        const dorsiFinal = dVal.toFixed(1);
        const plantarFinal = pVal.toFixed(1);
        const romFinal = (parseFloat(dorsiFinal) + parseFloat(plantarFinal)).toFixed(1);
        
        // บันทึกเข้า Firebase
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

// --- 5. แสดงผลตาราง History อัตโนมัติ ---
onValue(ref(db, 'history'), (snapshot) => {
    const data = snapshot.val();
    const tbody = document.getElementById("exerciseTableBody");
    if (!tbody) return;
    
    tbody.innerHTML = "";
    if (data) {
        // เรียงลำดับเซ็ต 1, 2, 3
        Object.values(data).sort((a, b) => a.set - b.set).forEach(row => {
            tbody.innerHTML += `
                <tr>
                    <td>${row.set}</td>
                    <td>${row.dorsi}</td>
                    <td>${row.plantar}</td>
                    <td>${row.rom}</td>
                </tr>`;
        });
    }
});