// === 1. KONFIGURÁCIÓ & INICIALIZÁLÁS ===
// Cseréld ki a saját Supabase projekt adataidra, ha élesíteni akarod az adatbázist!
const SUPABASE_URL = "https://sjzfuitvypvaafihcmkf.supabase.co";
const SUPABASE_KEY = "sb_publishable_dOYUJ6oIMDWddhc3BsJbJg_TUrwinIQ";
let supabase = null;

if (typeof window.supabase !== 'undefined' && SUPABASE_URL !== "https://YOUR_PROJECT_ID.supabase.co") {
    supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
}

// === 2. ÁLLAPOTKEZELÉS (STATE) ===
const AppState = {
    selectedDate: null,
    selectedTime: null
};

// === 3. NAVIGÁCIÓ ÉS NÉZETEK KEZELÉSE ===
function navigateTo(viewName) {
    document.querySelectorAll('.view-section').forEach(section => {
        section.classList.add('hidden');
    });

    const targetView = document.getElementById(`${viewName}-view`);
    if (targetView) {
        targetView.classList.remove('hidden');
        window.scrollTo(0, 0);
    }

    // Ha az admin felületre navigál, megpróbálja betölteni a foglalásokat
    if (viewName === 'admin-dashboard') {
        loadBookings();
    }
}

// === 4. MODAL KEZELŐK ===
function openBookingModal() {
    document.getElementById('booking-modal').classList.remove('hidden');
    generateCalendarSlots();
}

function closeBookingModal() {
    document.getElementById('booking-modal').classList.add('hidden');
    AppState.selectedDate = null;
    AppState.selectedTime = null;
}

// === 5. BEÉPÍTETT NAPTÁR GENERÁTOR LÓGIKA ===
function generateCalendarSlots() {
    const dateContainer = document.getElementById('date-slots-container');
    const timeContainer = document.getElementById('time-slots-container');
    
    dateContainer.innerHTML = '';
    timeContainer.innerHTML = '';

    // Következő 5 munkanap generálása (szombat/vasárnap kihagyásával)
    let addedDays = 0;
    let daysCount = 0;
    
    while (addedDays < 5) {
        const date = new Date();
        date.setDate(date.getDate() + daysCount + 1);
        daysCount++;

        if (date.getDay() !== 0 && date.getDay() !== 6) { // Hétköznapok
            const dateStr = date.toISOString().split('T')[0];
            const readableDate = date.toLocaleDateString('hu-HU', { month: 'short', day: 'numeric', weekday: 'short' });
            
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'date-slot-btn border border-gray-200 p-2 text-xs rounded hover:border-gray-900 transition text-center bg-white';
            btn.innerText = readableDate;
            btn.dataset.date = dateStr;
            btn.onclick = (e) => selectDateSlot(e, dateStr);
            
            dateContainer.appendChild(btn);
            addedDays++;
        }
    }

    // Idősávok (9:00 - 16:00 óránként)
    const hours = ['09:00', '10:00', '11:00', '13:00', '14:00', '15:00', '16:00'];
    hours.forEach(time => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'time-slot-btn border border-gray-200 p-1.5 text-xs rounded hover:border-gray-900 transition text-center bg-white';
        btn.innerText = time;
        btn.dataset.time = time;
        btn.onclick = (e) => selectTimeSlot(e, time);
        
        timeContainer.appendChild(btn);
    });
}

function selectDateSlot(e, dateStr) {
    document.querySelectorAll('.date-slot-btn').forEach(b => b.classList.remove('bg-gray-900', 'text-white', 'border-gray-900'));
    e.target.classList.add('bg-gray-900', 'text-white', 'border-gray-900');
    AppState.selectedDate = dateStr;
}

function selectTimeSlot(e, timeStr) {
    document.querySelectorAll('.time-slot-btn').forEach(b => b.classList.remove('bg-gray-900', 'text-white', 'border-gray-900'));
    e.target.classList.add('bg-gray-900', 'text-white', 'border-gray-900');
    AppState.selectedTime = timeStr;
}

// === 6. ADATBÁZIS MŰVELETEK (SUPABASE SERVICE) ===
async function saveBookingToDatabase(bookingData) {
    if (!supabase) {
        // Mock mentés (lokális teszteléshez, ha nincs még Supabase)
        console.log("Mock mentés sikeres (Supabase nincs bekötve):", bookingData);
        saveToLocalStorage(bookingData);
        return { success: true };
    }

    const { data, error } = await supabase.from('bookings').insert([bookingData]);
    if (error) return { success: false, error: error.message };
    return { success: true };
}

async function getBookingsFromDatabase() {
    if (!supabase) {
        return JSON.parse(localStorage.getItem('mock_bookings') || '[]');
    }

    const { data, error } = await supabase.from('bookings').select('*').order('created_at', { ascending: false });
    if (error) {
        console.error(error);
        return [];
    }
    return data;
}

// Tartalék lokális tárolás teszteléshez
function saveToLocalStorage(bookingData) {
    const current = JSON.parse(localStorage.getItem('mock_bookings') || '[]');
    bookingData.id = Date.now();
    bookingData.created_at = new Date().toISOString();
    current.push(bookingData);
    localStorage.setItem('mock_bookings', JSON.stringify(current));
}

// === 7. ŰRLAP KEZELŐK ÉS VALIDÁCIÓ ===
async function handleBookingSubmit(e) {
    e.preventDefault();
    
    if (!AppState.selectedDate || !AppState.selectedTime) {
        alert("Kérjük, válassz ki egy Napot és egy Időpontot is a konzultációhoz!");
        return;
    }

    const form = e.target;
    const bookingData = {
        full_name: form.full_name.value,
        phone: form.phone.value,
        email: form.email.value,
        age: parseInt(form.age.value),
        target_gender: form.target_gender.value,
        app_disappointment: form.app_disappointment.value,
        booking_date: AppState.selectedDate,
        booking_time: AppState.selectedTime
    };

    const response = await saveBookingToDatabase(bookingData);
    
    if (response.success) {
        alert("Köszönjük! A konzultációs időpontodat rögzítettük. Hamarosan keresni fogunk!");
        form.reset();
        closeBookingModal();
    } else {
        alert("Hiba történt a mentés során: " + response.error);
    }
}

// === 8. ADMIN FUNKCIÓK ===
async function handleAdminLogin(e) {
    e.preventDefault();
    const email = e.target.admin_email.value;
    const password = e.target.admin_password.value;

    if (supabase) {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) {
            alert("Sikertelen belépés! Ellenőrizd az adatokat.");
            return;
        }
    } else {
        // Ideiglenes teszt belépés, ha nincs Supabase konfigurálva
        if (email === "admin@parandcenter.hu" && password === "admin123") {
            console.log("Mock admin belépés sikeres.");
        } else {
            alert("Teszt belépéshez használd: admin@parandcenter.hu / admin123");
            return;
        }
    }
    navigateTo('admin-dashboard');
}

function handleAdminLogout() {
    if (supabase) supabase.auth.signOut();
    navigateTo('landing');
}

async function loadBookings() {
    const bookings = await getBookingsFromDatabase();
    const tableBody = document.getElementById('bookings-table-body');
    tableBody.innerHTML = '';

    if (bookings.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="6" class="p-4 text-center text-gray-400 text-sm">Még nincs beérkezett foglalás.</td></tr>`;
        return;
    }

    bookings.forEach(booking => {
        const row = document.createElement('tr');
        row.className = "border-b border-gray-100 hover:bg-gray-50 text-sm text-gray-700";
        row.innerHTML = `
            <td class="p-4 text-xs text-gray-400">${new Date(booking.created_at).toLocaleDateString('hu-HU')}</td>
            <td class="p-4 font-medium text-gray-900">${escapeHtml(booking.full_name)}</td>
            <td class="p-4 text-xs">${escapeHtml(booking.phone)}<br><span class="text-gray-400">${escapeHtml(booking.email)}</span></td>
            <td class="p-4">Kor: ${booking.age} | Keres: ${booking.target_gender}</td>
            <td class="p-4 text-xs italic text-gray-500 max-w-xs truncate" title="${escapeHtml(booking.app_disappointment)}">"${escapeHtml(booking.app_disappointment)}"</td>
            <td class="p-4 font-medium text-amber-900">${booking.booking_date} ${booking.booking_time}</td>
        `;
        tableBody.appendChild(row);
    });
}

// Biztonsági segédfüggvény (XSS védelem)
function escapeHtml(str) {
    return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}

// === 9. ESEMÉNYKEZELŐK BEKÖTÉSE ===
document.addEventListener("DOMContentLoaded", () => {
    document.getElementById('booking-form').addEventListener('submit', handleBookingSubmit);
    document.getElementById('login-form').addEventListener('submit', handleAdminLogin);
});