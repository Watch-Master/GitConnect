import { initializeApp } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, updateProfile, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-auth.js";
import { getFirestore, collection, addDoc, onSnapshot, query, orderBy, deleteDoc, getDocs, doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyDqknMhQhj0ZlFpJV1mi-xguSIE7B80mtI",
  authDomain: "gitconnect-67e83.firebaseapp.com",
  projectId: "gitconnect-67e83",
  storageBucket: "gitconnect-67e83.firebasestorage.app",
  messagingSenderId: "300781721118",
  appId: "1:300781721118:web:408cdccf257b2ef143800f",
  measurementId: "G-GH70EHR105"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

let currentUser = null;
let currentRoomId = null;
const MAIN_ADMIN_UID = "rcXrJhgQs6Tf5tX0eRkAoHKSj2u1"; 

// --- AUTH ---
window.handleSignUp = async () => {
    const email = document.getElementById('email').value;
    const pass = document.getElementById('password').value;
    const name = document.getElementById('display-name').value;
    try {
        const res = await createUserWithEmailAndPassword(auth, email, pass);
        await updateProfile(res.user, { displayName: name });
        alert("Account Created!");
    } catch (e) { alert(e.message); }
};

window.handleLogin = async () => {
    const email = document.getElementById('email').value;
    const pass = document.getElementById('password').value;
    try {
        await signInWithEmailAndPassword(auth, email, pass);
    } catch (e) { alert(e.message); }
};

onAuthStateChanged(auth, (user) => {
    currentUser = user;
    if (user) {
        document.getElementById('auth-container').classList.add('hidden');
        document.getElementById('room-container').classList.remove('hidden');
        loadRooms();
    } else {
        document.getElementById('auth-container').classList.remove('hidden');
        document.getElementById('room-container').classList.add('hidden');
    }
});

// --- ROOMS ---
async function loadRooms() {
    const q = query(collection(db, "rooms"));
    onSnapshot(q, (snapshot) => {
        const list = document.getElementById('room-list');
        list.innerHTML = '';
        snapshot.forEach(roomDoc => {
            const btn = document.createElement('button');
            btn.innerText = `Join ${roomDoc.data().name}`;
            btn.onclick = () => joinRoom(roomDoc.id, roomDoc.data().password);
            list.appendChild(btn);
        });
    });
}

window.createNewRoom = async () => {
    const name = document.getElementById('new-room-name').value;
    const pass = document.getElementById('new-room-pass').value;
    await addDoc(collection(db, "rooms"), {
        name: name,
        password: pass,
        adminId: currentUser.uid
    });
};

async function joinRoom(id, correctPass) {
    if (currentUser.uid !== MAIN_ADMIN_UID) {
        const attempt = prompt("Enter Room Password:");
        if (attempt !== correctPass) return alert("Wrong Password!");
    }
    currentRoomId = id;
    document.getElementById('room-container').classList.add('hidden');
    document.getElementById('chat-container').classList.remove('hidden');
    document.getElementById('active-room-name').innerText = "Room: " + id;
    
    listenForMessages();
    enterPresence(id);
}

// --- PRESENCE ---
async function enterPresence(roomId) {
    const presenceRef = doc(db, "rooms", roomId, "presence", currentUser.uid);
    await setDoc(presenceRef, {
        name: currentUser.displayName || "Anonymous",
        lastSeen: Date.now()
    });
    
    onSnapshot(collection(db, "rooms", roomId, "presence"), (snapshot) => {
        const userListUI = document.getElementById('user-list');
        userListUI.innerHTML = '';
        snapshot.forEach(userDoc => {
            const li = document.createElement('li');
            li.innerText = userDoc.data().name;
            userListUI.appendChild(li);
        });
    });
}

// --- CHAT LOGIC ---
function listenForMessages() {
    const q = query(collection(db, "rooms", currentRoomId, "messages"), orderBy("timestamp", "asc"));
    onSnapshot(q, (snapshot) => {
        const display = document.getElementById('chat-display');
        display.innerHTML = '';
        snapshot.forEach(msgDoc => {
            const data = msgDoc.data();
            const time = new Date(data.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
            display.innerHTML += `<div class="message"><span class="timestamp">${time}</span><b>${data.user}:</b> ${data.text}</div>`;
        });
        display.scrollTop = display.scrollHeight;
    });

    getDoc(doc(db, "rooms", currentRoomId)).then(docSnap => {
        if (currentUser.uid === MAIN_ADMIN_UID || docSnap.data().adminId === currentUser.uid) {
            document.getElementById('clear-btn').classList.remove('hidden');
        } else {
            document.getElementById('clear-btn').classList.add('hidden');
        }
    });
}

window.sendChatMessage = async () => {
    const input = document.getElementById('message-input');
    if (!input.value.trim()) return;
    await addDoc(collection(db, "rooms", currentRoomId, "messages"), {
        text: input.value,
        user: currentUser.displayName || "Anonymous",
        timestamp: Date.now()
    });
    input.value = "";
};

// Global listener for Enter Key
document.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && currentRoomId) {
        window.sendChatMessage();
    }
});

window.clearCurrentChat = async () => {
    if(!confirm("Clear all messages?")) return;
    const msgs = await getDocs(collection(db, "rooms", currentRoomId, "messages"));
    msgs.forEach(async (m) => await deleteDoc(doc(db, "rooms", currentRoomId, "messages", m.id)));
};

// --- NAVIGATION ---
window.backToRooms = async () => {
    if (currentRoomId && currentUser) {
        await deleteDoc(doc(db, "rooms", currentRoomId, "presence", currentUser.uid));
    }
    currentRoomId = null;
    document.getElementById('chat-container').classList.add('hidden');
    document.getElementById('room-container').classList.remove('hidden');
};

window.logout = async () => {
    try {
        if (currentRoomId) await window.backToRooms();
        await signOut(auth);
        alert("Logged out!");
    } catch (e) { console.error(e); }
};
