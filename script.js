import { initializeApp } from "https://www.gstatic.com/firebasejs/9.17.1/firebase-app.js";
import { getDatabase, ref, onValue, set } from "https://www.gstatic.com/firebasejs/9.17.1/firebase-database.js";

// --- 1. ตั้งค่า Firebase (กรุณาใส่ API Key และ App ID ของคุณให้ถูกต้อง) ---
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

// --- 2. รับค่าองศา Realtime และจัดการค่าลบ/ทศนิยม ---
onValue(ref(db, 'live/angleX'), (snapshot) => {
    // รับค่าจาก Firebase ถ้าไม่มีค่าให้เป็น 0
    currentAngle = snapshot.val() || 0;
    
    const dorsiEl = document.getElementById("liveDorsi");
    const plantarEl = document.getElementById("livePlantar");

    if (currentAngle >= 0) {
        // กรณี "ยกปลายเท้า" (ค่าเป็นบวก)
        dorsiEl.innerText = currentAngle.toFixed(1);
        plantarEl.innerText = "0.0"; 
    } else {
        // กรณี "เหยียดปลายเท้า" (ค่าติดลบ ให้ใช้ Math.abs เพื่อเปลี่ยนเป็นบวก)
        dorsiEl.innerText = "0.0";
        plantarEl.innerText = Math.abs(currentAngle).toFixed(1);
    }
});

// --- 3. ฟังก์ชันนับเวลาฝึก (30 วินาที) ---
function runPhase(name, seconds) {
    return new Promise((resolve) => {
        let timeLeft = seconds;
        document.getElementById("currentActionText").innerText = name;
        
        const interval = setInterval(() => {
            document.getElementById("timerDisplay").innerText = timeLeft;
            document.getElementById("timerBar").style.width = (timeLeft / 30) * 100 + "%";
            
            if (timeLeft <= 0) {
                clearInterval(interval);
                // ส่งค่าที่เป็นบวกกลับไปบันทึก (ใช้ Math.abs)
                resolve(Math.abs(currentAngle));
            }
            timeLeft--;
        }, 1000);
    });
}

// --- 4. ฟังก์ชันเริ่มการฝึก 5 เซ็ต ---
document.getElementById("startBtn").onclick = async () => {
    if (isRunning) return;
    isRunning = true;
    document.getElementById("startBtn").disabled = true;
    document.getElementById("startBtn").innerText = "กำลังฝึก...";

    for (let i = 1; i <= 5; i++) {
        document.getElementById("setCountDisplay").innerText = `${i} / 5`;
        
        // รับค่าสูงสุดระหว่างช่วงเวลา 30 วินาที
        const dVal = await runPhase("ยกปลายเท้า (Dorsi)", 30);
        const pVal = await runPhase("เหยียดปลายเท้า (Plantar)", 30);
        
        // คำนวณผลรวม ROM และจัดการทศนิยม
        const dorsiFinal = dVal.toFixed(1);
        const plantarFinal = pVal.toFixed(1);
        const romFinal = (parseFloat(dorsiFinal) + parseFloat(plantarFinal)).toFixed(1);
        
        // บันทึกข้อมูลลง Firebase ในโฟลเดอร์ history
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

// --- 5. ดึงข้อมูลจาก History มาแสดงในตารางแบบเรียงลำดับ ---
onValue(ref(db, 'history'), (snapshot) => {
    const data = snapshot.val();
    const tbody = document.getElementById("exerciseTableBody");
    tbody.innerHTML = ""; // ล้างค่าเก่าในตารางก่อน

    if (data) {
        // เปลี่ยน Object เป็น Array และเรียงตามลำดับเซ็ต (1, 2, 3...)
        const sortedData = Object.values(data).sort((a, b) => a.set - b.set);
        
        sortedData.forEach(row => {
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