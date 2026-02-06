import { initializeApp } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, updateProfile, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-auth.js";
import { getFirestore, collection, addDoc, onSnapshot, query, orderBy, deleteDoc, getDocs, doc, getDoc } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js";
import { setDoc, onSnapshot, doc, collection, deleteDoc } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js";

// 1. YOUR FIREBASE CONFIG HERE
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

// Global State
let currentUser = null;
let currentRoomId = null;
const MAIN_ADMIN_UID = "ajngu6ucLed3y8IWqFH3vhBgxt13"; 

// --- AUTH FUNCTIONS ---
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

window.handleLogin = () => {
    const email = document.getElementById('email').value;
    const pass = document.getElementById('password').value;
    signInWithEmailAndPassword(auth, email, pass).catch(e => alert(e.message));
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

// --- ROOM LOGIC ---
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
    listenForMessages();
  
    async function enterPresence(roomId) {
      const presenceRef = doc(db, "rooms", roomId, "presence", currentUser.uid);
      await setDoc(presenceRef, {
        name: currentUser.displayName || "Anonymous",
        lastSeen: Date.now()
      });
      
      // Listen for other users in this room
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

    // Check if current user is admin to show "Clear Chat"
    getDoc(doc(db, "rooms", currentRoomId)).then(docSnap => {
        if (currentUser.uid === MAIN_ADMIN_UID || docSnap.data().adminId === currentUser.uid) {
            document.getElementById('clear-btn').classList.remove('hidden');
        }
    });
}

window.sendChatMessage = async () => {
    const input = document.getElementById('message-input');
    if (!input.value) return;
    await addDoc(collection(db, "rooms", currentRoomId, "messages"), {
        text: input.value,
        user: currentUser.displayName || "Anonymous",
        timestamp: Date.now()
    });
    input.value = "";
};

window.clearCurrentChat = async () => {
    const msgs = await getDocs(collection(db, "rooms", currentRoomId, "messages"));
    msgs.forEach(async (m) => await deleteDoc(doc(db, "rooms", currentRoomId, "messages", m.id)));
};

// --- NAVIGATION & LOGOUT ---

// Fix for the "Exit Room" button
window.backToRooms = () => {
    currentRoomId = null; // Reset the current room
    document.getElementById('chat-container').classList.add('hidden');
    document.getElementById('room-container').classList.remove('hidden');
    const originalBackToRooms = window.backToRooms;
    window.backToRooms = async () => {
      if (currentRoomId && currentUser) {
        await deleteDoc(doc(db, "rooms", currentRoomId, "presence", currentUser.uid));
      }
      originalBackToRooms(); // Call the original navigation logic
    };
    // Optional: Refresh the page logic or stop the listener if needed
    // For a simple app, hiding the UI is usually enough.
};

// Fix for the "Logout" button
window.logout = async () => {
    try {
        await signOut(auth);
        // The onAuthStateChanged listener in the script will 
        // automatically handle hiding the room container.
        alert("Logged out successfully");
    } catch (e) {
        console.error("Logout Error:", e);
    }
};

// Add "Enter" key support for the message input
document.getElementById('message-input').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        window.sendChatMessage();
    }
});
