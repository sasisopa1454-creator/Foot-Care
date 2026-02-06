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

// 1. รับค่า Realtime (บังคับทศนิยมด้วย .toFixed(1) และ parseFloat)
onValue(ref(db, 'live/angleX'), (snapshot) => {
    currentAngle = parseFloat(snapshot.val() || 0);
    
    if (currentAngle >= 0) {
        document.getElementById("liveDorsi").innerText = currentAngle.toFixed(1);
        document.getElementById("livePlantar").innerText = "0.0"; 
    } else {
        document.getElementById("liveDorsi").innerText = "0.0";
        document.getElementById("livePlantar").innerText = Math.abs(currentAngle).toFixed(1);
    }
});

// 2. ฟังก์ชันนับเวลา (แก้ไขให้แถบวิ่งตรงตามเวลาที่ตั้งจริง)
function runPhase(name, seconds) {
    return new Promise((resolve) => {
        let timeLeft = seconds;
        document.getElementById("currentActionText").innerText = name;
        const interval = setInterval(() => {
            document.getElementById("timerDisplay").innerText = timeLeft;
            // ใช้ตัวหารเป็น seconds เพื่อให้แถบสัมพันธ์กับ 30 วินาที
            document.getElementById("timerBar").style.width = (timeLeft / seconds) * 100 + "%";
            if (timeLeft <= 0) {
                clearInterval(interval);
                resolve(Math.abs(currentAngle));
            }
            timeLeft--;
        }, 1000);
    });
}

// --- 3. ฟังก์ชันเริ่มการฝึก (ปรับเป็น 5 เซ็ต เซ็ตละ 30 วินาที) ---
document.getElementById("startBtn").onclick = async () => {
    if (isRunning) return;
    isRunning = true;
    document.getElementById("startBtn").disabled = true;
    document.getElementById("startBtn").innerText = "กำลังฝึก...";

    // แก้ไขจาก i <= 3 เป็น i <= 5 เพื่อให้ทำครบ 5 เซ็ต
    for (let i = 1; i <= 5; i++) {
        // แก้ไขตัวเลขแสดงผลให้เป็น / 5 ด้วย
        document.getElementById("setCountDisplay").innerText = `${i} / 5`;
        
        // ท่าละ 30 วินาที (คงเดิมตามคำแนะนำ)
        const dVal = await runPhase("ยกปลายเท้า (Dorsi)", 30); 
        const pVal = await runPhase("เหยียดปลายเท้า (Plantar)", 30);
        
        const dStr = dVal.toFixed(1);
        const pStr = pVal.toFixed(1);
        const romStr = (parseFloat(dStr) + parseFloat(pStr)).toFixed(1);
        
        // บันทึกเข้า Firebase
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
    isRunning = false;
};

// 4. แสดงตาราง History
onValue(ref(db, 'history'), (snapshot) => {
    const data = snapshot.val();
    const tbody = document.getElementById("exerciseTableBody");
    if (!tbody) return;
    tbody.innerHTML = "";
    if (data) {
        Object.values(data).sort((a, b) => a.set - b.set).forEach(row => {
            tbody.innerHTML += `<tr><td>${row.set}</td><td>${row.dorsi}</td><td>${row.plantar}</td><td>${row.rom}</td></tr>`;
        });
    }
});