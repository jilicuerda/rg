// --- 1. SUPABASE SETUP ---
const supabaseUrl = 'https://kjdasywpteblqnbuvony.supabase.co';
// This is your SAFE public anon key
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtqZGFzeXdwdGVibHFuYnV2b255Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgxNDEyNDYsImV4cCI6MjA5MzcxNzI0Nn0.5-6pV2SSJaAZ_9Lse1Tf-hso3SmutfrWrgwwM7vakxE';

// FIXED: We renamed 'supabase' to 'db' so it doesn't clash with the library name!
const db = window.supabase.createClient(supabaseUrl, supabaseKey);

// --- 2. STATE ---
const users = {
    'jilicuerda': { password: 'jili', role: 'admin' },
    'lovisa': { password: '123', role: 'user' }
};

let currentUser = null;
let currentViewDate = new Date(); 
let currentViewMode = 'week'; 
let cachedEvents = []; 
let cachedTodos = [];  

const monthsEn = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const daysEn = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// --- 3. LOGIN/LOGOUT ---
function attemptLogin() {
    const userIn = document.getElementById('username').value.trim().toLowerCase();
    const passIn = document.getElementById('password').value;
    const errorDiv = document.getElementById('login-error');

    if (users[userIn] && users[userIn].password === passIn) {
        currentUser = { username: userIn, role: users[userIn].role };
        errorDiv.innerText = "";
        showDashboard();
    } else {
        errorDiv.innerText = "Invalid username or password.";
    }
}

function logout() {
    currentUser = null;
    document.getElementById('username').value = "";
    document.getElementById('password').value = "";
    document.getElementById('login-screen').classList.remove('hidden');
    document.getElementById('app-dashboard').classList.add('hidden');
}

async function showDashboard() {
    document.getElementById('login-screen').classList.add('hidden');
    document.getElementById('app-dashboard').classList.remove('hidden');
    
    const formattedName = currentUser.username.charAt(0).toUpperCase() + currentUser.username.slice(1);
    document.getElementById('user-display-name').innerText = formattedName;

    if (currentUser.role === 'admin') {
        document.getElementById('admin-panel').classList.remove('hidden');
    } else {
        document.getElementById('admin-panel').classList.add('hidden');
    }

    await loadTodosFromCloud();
    await fetchEventsFromCloud();
}

// --- 4. VIEW & DATE LOGIC ---
function getStartOfView(date) {
    const d = new Date(date);
    if (currentViewMode === 'day') return d; 
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1); 
    return new Date(d.setDate(diff));
}

function getDaysInView() {
    if (currentViewMode === 'day') return 1;
    if (currentViewMode === 'workweek') return 5; 
    return 7; 
}

async function changeView(viewType) {
    currentViewMode = viewType;
    const grid = document.getElementById('calendar-grid');
    grid.className = 'calendar-grid view-' + viewType;
    await fetchEventsFromCloud(); 
}

async function navigateTime(direction) {
    if (currentViewMode === 'day') {
        currentViewDate.setDate(currentViewDate.getDate() + direction);
    } else {
        currentViewDate.setDate(currentViewDate.getDate() + (direction * 7));
    }
    await fetchEventsFromCloud();
}

async function jumpToToday() {
    currentViewDate = new Date();
    await fetchEventsFromCloud();
}

function updateDateRangeDisplay(startDate, numDays) {
    const endDate = new Date(startDate);
    endDate.setDate(startDate.getDate() + (numDays - 1));

    if (numDays === 1) {
        const day = startDate.getDate().toString().padStart(2, '0');
        const month = monthsEn[startDate.getMonth()];
        const year = startDate.getFullYear();
        document.getElementById('week-date-range').innerText = `${month} ${day}, ${year}`;
    } else {
        const startDay = startDate.getDate().toString().padStart(2, '0');
        const endDay = endDate.getDate().toString().padStart(2, '0');
        const monthStr = monthsEn[startDate.getMonth()];
        const yearStr = startDate.getFullYear();
        document.getElementById('week-date-range').innerText = `${monthStr} ${startDay}-${endDay}, ${yearStr}`;
    }
}

function isSameDay(d1, d2) {
    return d1.getFullYear() === d2.getFullYear() && d1.getMonth() === d2.getMonth() && d1.getDate() === d2.getDate();
}

// --- 5. CLOUD CALENDAR LOGIC ---

async function fetchEventsFromCloud() {
    const { data, error } = await db.from('events').select('*');
    if (error) console.error("Error fetching events:", error);
    if (data) cachedEvents = data;
    
    renderCalendar(); 
}

async function saveEvent(dateStr, hourStr, text, color) {
    if (text.trim() === '') {
        await db.from('events').delete().match({ event_date: dateStr, event_hour: hourStr });
    } else {
        await db.from('events').upsert(
            { event_date: dateStr, event_hour: hourStr, text: text, color: color },
            { onConflict: 'event_date, event_hour' }
        );
    }
    fetchEventsFromCloud(); 
}

function renderCalendar() {
    const grid = document.getElementById('calendar-grid');
    grid.innerHTML = ''; 
    
    const startDate = getStartOfView(currentViewDate);
    const numDays = getDaysInView();
    const today = new Date();

    updateDateRangeDisplay(startDate, numDays);

    const tlCell = document.createElement('div');
    tlCell.className = 'grid-header-cell time-col';
    grid.appendChild(tlCell);

    for (let i = 0; i < numDays; i++) {
        const cellDate = new Date(startDate);
        cellDate.setDate(startDate.getDate() + i);
        
        const headerCell = document.createElement('div');
        headerCell.className = 'grid-header-cell';
        if (isSameDay(cellDate, today)) headerCell.classList.add('current-day-header');

        const dayNum = document.createElement('div');
        dayNum.className = 'day-number';
        dayNum.innerText = cellDate.getDate().toString().padStart(2, '0');

        const dayName = document.createElement('div');
        dayName.className = 'day-name';
        dayName.innerText = daysEn[cellDate.getDay()];

        headerCell.appendChild(dayNum);
        headerCell.appendChild(dayName);
        grid.appendChild(headerCell);
    }

    for (let h = 0; h < 24; h++) {
        const timeCell = document.createElement('div');
        timeCell.className = 'time-label';
        timeCell.innerText = h.toString().padStart(2, '0') + ':00';
        grid.appendChild(timeCell);

        for (let d = 0; d < numDays; d++) {
            const cellDate = new Date(startDate);
            cellDate.setDate(startDate.getDate() + d);
            const dateStr = cellDate.toISOString().split('T')[0]; 
            const hourStr = h.toString().padStart(2, '0');

            const cell = document.createElement('div');
            cell.className = 'grid-cell';
            if (isSameDay(cellDate, today)) cell.classList.add('current-day-cell');

            cell.ondragover = (e) => { e.preventDefault(); cell.classList.add('drag-over'); };
            cell.ondragleave = (e) => { cell.classList.remove('drag-over'); };
            cell.ondrop = (e) => handleDrop(e, dateStr, hourStr, cell);

            const input = document.createElement('textarea');
            input.className = 'cell-input';
            
            const eventObj = cachedEvents.find(e => e.event_date === dateStr && e.event_hour === hourStr);
            let hasContent = false;

            if (eventObj) {
                input.value = eventObj.text || '';
                if (input.value.trim() !== '') hasContent = true;
                if (eventObj.color) {
                    cell.style.backgroundColor = applyTransparency(eventObj.color, 0.2);
                }
            }

            input.addEventListener('change', (e) => {
                const existingColor = eventObj ? eventObj.color : null;
                saveEvent(dateStr, hourStr, e.target.value, existingColor);
            });

            cell.appendChild(input);

            if (hasContent) {
                const clearBtn = document.createElement('button');
                clearBtn.innerHTML = '×';
                clearBtn.className = 'clear-cell-btn';
                clearBtn.title = "Clear this slot";
                clearBtn.onclick = () => saveEvent(dateStr, hourStr, '', null);
                cell.appendChild(clearBtn);
            }

            grid.appendChild(cell);
        }
    }
}

function applyTransparency(hex, alpha) {
    if(!hex || !hex.startsWith('#')) return '';
    let r = parseInt(hex.slice(1, 3), 16),
        g = parseInt(hex.slice(3, 5), 16),
        b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// --- 6. DRAG AND DROP ---
function handleDragStart(e, index) {
    e.dataTransfer.setData('text/plain', index);
}

function handleDrop(e, dateStr, hourStr, cellElement) {
    e.preventDefault();
    cellElement.classList.remove('drag-over');
    
    const todoIndex = e.dataTransfer.getData('text/plain');
    if (todoIndex === '') return;

    const task = cachedTodos[todoIndex];
    
    const existingEvent = cachedEvents.find(ev => ev.event_date === dateStr && ev.event_hour === hourStr);
    let existingText = existingEvent ? existingEvent.text : "";

    const newText = existingText ? existingText + "\n" + task.text : task.text;
    
    saveEvent(dateStr, hourStr, newText, task.color);
}

// --- 7. CLOUD TO-DO LIST LOGIC ---

async function loadTodosFromCloud() {
    const { data, error } = await db.from('todos').select('*').order('created_at', { ascending: true });
    if (error) console.error("Error fetching todos:", error);
    if (data) {
        cachedTodos = data;
        renderTodos();
    }
}

function renderTodos() {
    const list = document.getElementById('todo-list');
    list.innerHTML = '';

    cachedTodos.forEach((todo, index) => {
        const li = document.createElement('li');
        li.style.borderLeftColor = todo.color || 'var(--primary-color)';
        
        li.draggable = true;
        li.ondragstart = (e) => handleDragStart(e, index);

        if (todo.completed) li.classList.add('completed');

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.checked = todo.completed;
        checkbox.onchange = () => toggleTodo(todo.id, todo.completed);
        checkbox.style.marginTop = '4px';

        const span = document.createElement('span');
        span.innerText = todo.text;
        span.onclick = () => toggleTodo(todo.id, todo.completed);

        const delBtn = document.createElement('button');
        delBtn.innerHTML = '×';
        delBtn.className = 'delete-btn';
        delBtn.title = "Delete Task";
        delBtn.onclick = () => deleteTodo(todo.id);

        li.appendChild(checkbox);
        li.appendChild(span);
        li.appendChild(delBtn);
        list.appendChild(li);
    });
}

function handleTodoKeyPress(e) {
    if (e.key === 'Enter') addTodo();
}

async function addTodo() {
    const input = document.getElementById('new-todo');
    const colorInput = document.getElementById('todo-color');
    const text = input.value.trim();
    const color = colorInput.value;

    if (text === '') return;

    await db.from('todos').insert({ text: text, color: color, completed: false });
    
    input.value = '';
    loadTodosFromCloud();
}

async function toggleTodo(id, currentStatus) {
    await db.from('todos').update({ completed: !currentStatus }).eq('id', id);
    loadTodosFromCloud();
}

async function deleteTodo(id) {
    await db.from('todos').delete().eq('id', id);
    loadTodosFromCloud();
}

// --- 8. ADMIN LOGIC ---
async function clearAllData() {
    if(confirm("ADMIN: Are you sure you want to delete ALL data from the cloud? This cannot be undone.")) {
        await db.from('events').delete().not('id', 'is', null);
        await db.from('todos').delete().not('id', 'is', null);
        
        await fetchEventsFromCloud();
        await loadTodosFromCloud();
        alert("Cloud database cleared.");
    }
}