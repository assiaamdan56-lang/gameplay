const firebaseConfig = {
    apiKey: "AIzaSyCPFWFfOu52lXsn4zw9g_MpolXliKSAz0",
    authDomain: "qur3a-acad5.firebaseapp.com",
    databaseURL: "https://qur3a-acad5-default-rtdb.firebaseio.com",
    projectId: "qur3a-acad5",
    storageBucket: "qur3a-acad5.firebasestorage.app",
    messagingSenderId: "43636337221",
    appId: "1:43636337221:web:201025dca4d26e9713512c"
};

if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
const db = firebase.database();

let currentRoomCode = "";
let currentUser = "";
let isHost = false;
let roomRef = null;
let timerInterval = null;
let timeLeft = 60;
let mediaRecorder = null;
let audioChunks = [];

let homeScene, homeRenderer, gameScene, gameRenderer, diceMesh;

document.addEventListener("DOMContentLoaded", () => {
    showPage("homePage");
    init3DDice();
});

function showPage(pageId) {
    document.querySelectorAll(".page").forEach(p => p.classList.remove("active"));
    document.getElementById(pageId).classList.add("active");
    updateBottomNav(pageId);
}

function updateBottomNav(pageId) {
    document.querySelectorAll(".nav-item").forEach(i => i.classList.remove("active"));
    if (pageId === "gamePage") document.querySelectorAll(".nav-item")[0].classList.add("active");
    if (pageId === "chatPage") document.querySelectorAll(".nav-item")[1].classList.add("active");
    if (pageId === "profilePage") document.querySelectorAll(".nav-item")[2].classList.add("active");

    const nav = document.getElementById("bottomNav");
    nav.style.display = (pageId === "homePage" || pageId === "adminPage") ? "none" : "flex";
}

function init3DDice() {
    const homeContainer = document.getElementById("homeDiceCanvas");
    if (homeContainer && !homeScene) {
        homeScene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 1000);
        camera.position.z = 5;

        homeRenderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
        homeRenderer.setSize(homeContainer.clientWidth, homeContainer.clientHeight);
        homeContainer.appendChild(homeRenderer.domElement);

        const geometry = new THREE.BoxGeometry(1.8, 1.8, 1.8);
        const material = new THREE.MeshStandardMaterial({ color: 0xb397dc, roughness: 0.3 });
        const dice = new THREE.Mesh(geometry, material);
        homeScene.add(dice);

        const light = new THREE.PointLight(0xffffff, 2);
        light.position.set(5, 5, 5);
        homeScene.add(light);
        homeScene.add(new THREE.AmbientLight(0xffffff, 0.8));

        function animateHome() {
            requestAnimationFrame(animateHome);
            dice.rotation.x += 0.01;
            dice.rotation.y += 0.015;
            homeRenderer.render(homeScene, camera);
        }
        animateHome();
    }

    const gameContainer = document.getElementById("gameDiceCanvas");
    if (gameContainer && !gameScene) {
        gameScene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 1000);
        camera.position.z = 5;

        gameRenderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
        gameRenderer.setSize(gameContainer.clientWidth, gameContainer.clientHeight);
        gameContainer.appendChild(gameRenderer.domElement);

        const geometry = new THREE.BoxGeometry(2, 2, 2);
        const material = new THREE.MeshStandardMaterial({ color: 0xe572a1, roughness: 0.2 });
        diceMesh = new THREE.Mesh(geometry, material);
        gameScene.add(diceMesh);

        const light = new THREE.PointLight(0xffffff, 2);
        light.position.set(5, 5, 5);
        gameScene.add(light);
        gameScene.add(new THREE.AmbientLight(0xffffff, 0.9));

        function animateGame() {
            requestAnimationFrame(animateGame);
            if (diceMesh) {
                diceMesh.rotation.x += 0.005;
                diceMesh.rotation.y += 0.008;
            }
            gameRenderer.render(gameScene, camera);
        }
        animateGame();
    }
}

function confirmCreateRoom() {
    const hostName = document.getElementById("createHostName").value.trim();
    const pin = document.getElementById("createPinInput").value.trim();
    if (!hostName || !pin) return alert("A3fak 3amer ga3 l'khanat!");

    currentUser = hostName;
    isHost = true;
    currentRoomCode = pin;
    initRoom(true);
}

function confirmJoinRoom() {
    const code = document.getElementById("joinRoomCodeInput").value.trim();
    const name = document.getElementById("joinPlayerName").value.trim();
    if (!code || !name) return alert("A3fak 3amer code w smiytek!");

    currentRoomCode = code;
    currentUser = name;

    db.ref(`rooms/${currentRoomCode}`).once('value', snapshot => {
        if (snapshot.exists()) {
            isHost = (snapshot.val().host === currentUser);
            initRoom(false);
        } else {
            alert("⚠️ Had room ma kaynach!");
        }
    });
}

function initRoom(creator) {
    roomRef = db.ref(`rooms/${currentRoomCode}`);

    document.getElementById("profileDisplayName").textContent = currentUser;
    document.getElementById("profileUsername").textContent = `@${currentUser.toLowerCase().replace(/ /g, "_")}`;
    document.getElementById("profileAvatarLetter").textContent = currentUser[0].toUpperCase();

    if (creator) {
        roomRef.set({ host: currentUser, state: "lobby" });
    }

    document.getElementById("profileBadgeRole").textContent = isHost ? "👑 Admin" : "👤 Joueur";
    document.getElementById("adminPanelBtn").classList.toggle("hidden", !isHost);

    roomRef.child(`players/${currentUser}`).set({ name: currentUser, isHost: isHost });

    document.getElementById("roomNumber").textContent = `Room #${currentRoomCode}`;
    document.getElementById("chatHeaderCode").textContent = `Room #${currentRoomCode}`;

    setupFirebaseListeners();
    showPage("gamePage");
}

function leaveRoom() {
    if (roomRef && currentUser) {
        roomRef.child(`players/${currentUser}`).remove();
    }
    window.location.reload();
}

function setupFirebaseListeners() {
    roomRef.child('players').on('value', snapshot => {
        const playersObj = snapshot.val() || {};
        const players = Object.values(playersObj);
        
        document.getElementById("playerCount").textContent = players.length;
        document.getElementById("chatPlayersCount").textContent = `${players.length} حاضين f l'room`;

        const miniList = document.getElementById("miniPlayersList");
        const modalList = document.getElementById("allPlayersModalList");
        const adminList = document.getElementById("allPlayersContainer");

        miniList.innerHTML = "";
        modalList.innerHTML = "";
        adminList.innerHTML = "";

        players.slice(0, 3).forEach(p => {
            miniList.innerHTML += `
                <div class="mini-player-card">
                    <div class="user-avatar-circle">${p.name[0].toUpperCase()}</div>
                    <span>${escapeHTML(p.name)}</span>
                </div>`;
        });

        players.forEach(p => {
            modalList.innerHTML += `<div class="admin-item"><span>${escapeHTML(p.name)} ${p.isHost ? '👑' : ''}</span></div>`;
            adminList.innerHTML += `
                <div class="admin-item">
                    <span>${escapeHTML(p.name)} (${p.isHost ? 'Admin' : 'Joueur'})</span>
                    <button class="link-btn" onclick="kickPlayer('${p.name}')">🗑️</button>
                </div>`;
        });
    });

    roomRef.child('questions').on('value', snapshot => {
        const qObj = snapshot.val() || {};
        const container = document.getElementById("allQuestionsContainer");
        container.innerHTML = "";
        Object.entries(qObj).forEach(([id, q]) => {
            container.innerHTML += `
                <div class="admin-item">
                    <div><strong>${escapeHTML(q.text)}</strong><br><small style="color:var(--text-muted)">Par: ${escapeHTML(q.author)}</small></div>
                    <button class="link-btn" onclick="deleteQuestion('${id}')">🗑️</button>
                </div>`;
        });
    });

    roomRef.child('state').on('value', snapshot => {
        const state = snapshot.val() || "lobby";
        document.getElementById("lobbyStage").classList.add("hidden");
        document.getElementById("questionStage").classList.add("hidden");
        document.getElementById("judgeStage").classList.add("hidden");
        clearInterval(timerInterval);

        if (state === "lobby") {
            document.getElementById("lobbyStage").classList.remove("hidden");
        } else if (state === "question") {
            document.getElementById("questionStage").classList.remove("hidden");
            roomRef.once('value', s => {
                const data = s.val();
                document.getElementById("chosenAvatar").textContent = data.chosenPlayer[0].toUpperCase();
                document.getElementById("chosenPlayerText").textContent = `${data.chosenPlayer} - jat fik l'qor3a! 🎉`;
                document.getElementById("questionText").textContent = data.currentQuestion;
            });
            startTimer();
        } else if (state === "judge") {
            document.getElementById("judgeStage").classList.remove("hidden");
            roomRef.child('winningJudge').on('value', wSnap => {
                const wText = wSnap.val();
                if (wText) {
                    document.getElementById("proofSubmissionSection").classList.remove("hidden");
                    document.getElementById("winningJudgeText").textContent = `الحكم الفائز: ${wText}`;
                }
            });
        }
    });

    roomRef.child('votes').on('value', snapshot => {
        const votes = snapshot.val() || {};
        const total = Object.keys(votes).length || 1;
        const counts = { requestion: 0, retirage: 0, pass: 0 };
        Object.values(votes).forEach(v => { if (counts[v.type] !== undefined) counts[v.type]++; });

        document.getElementById("pct_requestion").textContent = `${Math.round((counts.requestion / total) * 100)}%`;
        document.getElementById("pct_retirage").textContent = `${Math.round((counts.retirage / total) * 100)}%`;
        document.getElementById("pct_pass").textContent = `${Math.round((counts.pass / total) * 100)}%`;
    });

    roomRef.child('proof').on('value', snapshot => {
        const proofData = snapshot.val();
        const proofCard = document.getElementById("proofDisplayCard");
        if (proofData) {
            proofCard.classList.remove("hidden");
            document.getElementById("proofContentText").textContent = `إثبات التنفيذ من ${proofData.sender}: ${proofData.text}`;
            const hearts = proofData.hearts || {};
            const heartCount = Object.keys(hearts).length;
            document.getElementById("heartCount").textContent = heartCount;

            roomRef.child('players').once('value', pSnap => {
                const totalPlayers = Object.keys(pSnap.val() || {}).length || 1;
                const majority = Math.floor(totalPlayers / 2) + 1;

                if (heartCount >= majority) {
                    document.getElementById("heartStatusText").textContent = "تمت الموافقة من الأغلبية! العودة للقرعة...";
                    setTimeout(() => {
                        if (isHost) roomRef.update({ state: "lobby", proof: null, winningJudge: null, votes: null });
                    }, 2000);
                }
            });
        } else {
            proofCard.classList.add("hidden");
        }
    });

    roomRef.child('chat').on('value', snapshot => {
        const chatObj = snapshot.val() || {};
        const container = document.getElementById("messagesContainer");
        container.innerHTML = "";

        Object.values(chatObj).forEach(msg => {
            const isMe = msg.sender === currentUser;
            let content = `<p>${escapeHTML(msg.text || '')}</p>`;
            if (msg.image) content += `<img src="${msg.image}" style="max-width:100%; border-radius:12px; margin-top:5px;">`;
            if (msg.audio) content += `<audio controls src="${msg.audio}" style="margin-top:5px; width:100%;"></audio>`;

            container.innerHTML += `
                <div class="chat-message ${isMe ? 'sent' : ''}">
                    <div class="chat-bubble">
                        ${!isMe ? `<strong style="font-size:10px; color:var(--purple-light); display:block; margin-bottom:2px;">${escapeHTML(msg.sender)}</strong>` : ''}
                        ${content}
                    </div>
                </div>`;
        });
        container.scrollTop = container.scrollHeight;
    });
}

function startDraw() {
    if (!isHost) return alert("⚠️ Ghir l'admin li 3ndo l'7a9 ydour l'qor3a!");

    roomRef.child('questions').once('value', sQ => {
        const questions = Object.values(sQ.val() || {});
        if (questions.length === 0) return alert("⚠️ Ma kayninch as2ila! Zidhoum men l'profil awla l'admin.");

        roomRef.child('players').once('value', sP => {
            const players = Object.values(sP.val() || {});
            const randomPlayer = players[Math.floor(Math.random() * players.length)].name;
            const randomQuestion = questions[Math.floor(Math.random() * questions.length)].text;

            if (diceMesh) {
                diceMesh.rotation.x += Math.PI * 2;
                diceMesh.rotation.y += Math.PI * 2;
            }

            setTimeout(() => {
                roomRef.update({
                    state: "question",
                    chosenPlayer: randomPlayer,
                    currentQuestion: randomQuestion,
                    votes: null,
                    proof: null,
                    winningJudge: null
                });
            }, 1000);
        });
    });
}

function startTimer() {
    clearInterval(timerInterval);
    timeLeft = 60;
    document.getElementById("timer").textContent = "01:00";
    timerInterval = setInterval(() => {
        timeLeft--;
        const m = String(Math.floor(timeLeft / 60)).padStart(2, "0");
        const s = String(timeLeft % 60).padStart(2, "0");
        document.getElementById("timer").textContent = `${m}:${s}`;
        if (timeLeft <= 0) {
            clearInterval(timerInterval);
            if (isHost) roomRef.update({ state: "judge" });
        }
    }, 1000);
}

function submitAnswer() {
    const input = document.getElementById("answerInput");
    const val = input.value.trim();
    const box = document.querySelector(".inline-answer-box");

    if (!val) {
        box.classList.add("error");
        setTimeout(() => box.classList.remove("error"), 600);
        return;
    }

    roomRef.child('chat').push({ sender: currentUser, text: `جاوب على السؤال: ${val}`, time: Date.now() });
    input.value = "";
    if (isHost) roomRef.update({ state: "judge" });
}

function cantAnswer() {
    clearInterval(timerInterval);
    if (isHost) roomRef.update({ state: "judge" });
}

function vote(type) {
    if (!roomRef) return;
    roomRef.child(`votes/${currentUser}`).set({ type: type });
}

function addJudgement() {
    const val = document.getElementById("judgementInput").value.trim();
    if (!val) return;
    roomRef.child('winningJudge').set(val);
    document.getElementById("judgementInput").value = "";
}

function submitProof() {
    const val = document.getElementById("proofTextInput").value.trim();
    if (!val) return;
    roomRef.child('proof').set({ sender: currentUser, text: val, hearts: {} });
    document.getElementById("proofTextInput").value = "";
}

function toggleHeartVote() {
    roomRef.child(`proof/hearts/${currentUser}`).once('value', snapshot => {
        if (snapshot.exists()) {
            roomRef.child(`proof/hearts/${currentUser}`).remove();
        } else {
            roomRef.child(`proof/hearts/${currentUser}`).set(true);
        }
    });
}

function sendTextMessage() {
    const input = document.getElementById("messageTextInput");
    const text = input.value.trim();
    if (!text || !roomRef) return;
    roomRef.child('chat').push({ sender: currentUser, text: text, time: Date.now() });
    input.value = "";
}

function handleChatKeyDown(e) { if (e.key === "Enter") sendTextMessage(); }

function sendImageMessage(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = evt => {
        roomRef.child('chat').push({ sender: currentUser, image: evt.target.result, time: Date.now() });
    };
    reader.readAsDataURL(file);
}

function toggleAudioRecord() {
    const btn = document.getElementById("audioRecordBtn");
    if (mediaRecorder && mediaRecorder.state === "recording") {
        mediaRecorder.stop();
        btn.style.color = "var(--text-muted)";
    } else {
        navigator.mediaDevices.getUserMedia({ audio: true }).then(stream => {
            mediaRecorder = new MediaRecorder(stream);
            audioChunks = [];
            mediaRecorder.ondataavailable = e => audioChunks.push(e.data);
            mediaRecorder.onstop = () => {
                const blob = new Blob(audioChunks, { type: 'audio/mp3' });
                const reader = new FileReader();
                reader.onload = evt => {
                    roomRef.child('chat').push({ sender: currentUser, audio: evt.target.result, time: Date.now() });
                };
                reader.readAsDataURL(blob);
            };
            mediaRecorder.start();
            btn.style.color = "var(--error-red)";
        });
    }
}

function openInlineAddQuestion() {
    document.getElementById("inlineQuestionForm").classList.toggle("hidden");
}

function saveMyQuestion() {
    const input = document.getElementById("myNewQuestionInput");
    const qText = input.value.trim();
    if (!qText || !roomRef) return;

    const qId = db.ref().child('rooms').push().key;
    roomRef.child(`questions/${qId}`).set({ id: qId, text: qText, author: currentUser });

    document.getElementById("myQuestionsList").innerHTML += `<div class="admin-item"><span>${escapeHTML(qText)}</span></div>`;
    input.value = "";
    document.getElementById("inlineQuestionForm").classList.add("hidden");
}

function deleteQuestion(qId) { if (roomRef) roomRef.child(`questions/${qId}`).remove(); }
function kickPlayer(name) { if (roomRef) roomRef.child(`players/${name}`).remove(); }

function updateProfilePicture(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = evt => {
        const img = document.getElementById("profileImage");
        img.src = evt.target.result;
        img.classList.remove("hidden");
        document.getElementById("profileAvatarLetter").classList.add("hidden");
    };
    reader.readAsDataURL(file);
}

function openPlayersModal() { document.getElementById("playersModal").classList.remove("hidden"); }
function closePlayersModal() { document.getElementById("playersModal").classList.add("hidden"); }

function openAdminPage() { showPage("adminPage"); }
function switchAdminTab(tab) {
    document.getElementById("adminQuestionsSection").classList.toggle("hidden", tab !== "questions");
    document.getElementById("adminPlayersSection").classList.toggle("hidden", tab !== "players");
    document.getElementById("tabQuestionsBtn").classList.toggle("active", tab === "questions");
    document.getElementById("tabPlayersBtn").classList.toggle("active", tab === "players");
}

function escapeHTML(str) {
    const d = document.createElement("div");
    d.textContent = str;
    return d.innerHTML;
}