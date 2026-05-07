// --- 1. SUPABASE SETUP ---
const supabaseUrl = 'https://kjdasywpteblqnbuvony.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtqZGFzeXdwdGVibHFuYnV2b255Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgxNDEyNDYsImV4cCI6MjA5MzcxNzI0Nn0.5-6pV2SSJaAZ_9Lse1Tf-hso3SmutfrWrgwwM7vakxE';
const db = window.supabase.createClient(supabaseUrl, supabaseKey);

// --- 2. STATE ---
const users = { 'jilicuerda': { password: 'jili', role: 'admin' }, 'lovisa': { password: '123', role: 'user' } };
let currentUser = null;
let currentViewDate = new Date(); 
let currentViewMode = 'week'; 
let cachedEvents = []; 
let cachedTodos = [];  

const monthsEn = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const daysEn = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// --- 3. UPLOAD HELPER ---
// Takes a file, uploads to 'backgrounds' bucket, returns the URL
async function uploadImageToSupabase(file) {
    const fileExt = file.name.split('.').pop();
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
    
    const { error } = await db.storage.from('backgrounds').upload(fileName, file);
    if (error) {
        alert("Error uploading image: " + error.message);
        return null;
    }
    
    const { data } = db.storage.from('backgrounds').getPublicUrl(fileName);
    return data.publicUrl;
}

// --- 4. LOGIN & SITE BACKGROUND ---
async function attemptLogin() {
    const userIn = document.getElementById('username').value.trim().toLowerCase();
    const passIn = document.getElementById('password').value;
    const errorDiv = document.getElementById('login-error');

    if (users[userIn] && users[userIn].password === passIn) {
        currentUser = { username: userIn, role: users[userIn].role };
        errorDiv.innerText = "";
        
        // Fetch personal site background
        const { data } = await db.from('user_settings').select('site_bg').eq('username', currentUser.username).single();
        if (data && data.site_bg) {
            document.body.style.backgroundImage = `url('${data.site_bg}')`;
        }

        showDashboard();
    } else {
        errorDiv.innerText = "Invalid username or password.";
    }
}

async function updateSiteBackground(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    document.getElementById('user-display-name').innerText = "Uploading BG...";
    const imageUrl = await uploadImageToSupabase(file);
    
    if (imageUrl) {
        document.body.style.backgroundImage = `url('${imageUrl}')`;
        await db.from('user_settings').upsert({ username: currentUser.username, site_bg: imageUrl });
    }
    document.getElementById('user-display-name').innerText = currentUser.username;
}

function logout() {
    currentUser = null;
    document.body.style.backgroundImage = "none";
    document.getElementById('login-screen').classList.remove('hidden');
    document.getElementById('app-dashboard').classList.add('hidden');
}

async function showDashboard() {
    document.getElementById('login-screen').classList.add('hidden');
    document.getElementById('app-dashboard').classList.remove('hidden');
    document.getElementById('user-display-name').innerText = currentUser.username;
    if (currentUser.role === 'admin') document.getElementById('admin-panel').classList.remove('hidden');
    
    await loadTodosFromCloud();
    await fetchEventsFromCloud();
}

// --- 5. VIEWS ---
async function changeView(viewType) {
    currentViewMode = viewType;
    const grid = document.getElementById('calendar-grid');
    grid.className = 'calendar-grid view-' + viewType;
    renderCalendar(); 
}

async function navigateTime(direction) {
    if (currentViewMode === 'day') currentViewDate.setDate(currentViewDate.getDate() + direction);
    else if (currentViewMode === 'month') currentViewDate.setMonth(currentViewDate.getMonth() + direction);
    else currentViewDate.setDate(currentViewDate.getDate() + (direction * 7));
    renderCalendar();
}

async function jumpToToday() {
    currentViewDate = new Date();
    renderCalendar();
}

// --- 6. RENDER CALENDAR CORE ---
async function fetchEventsFromCloud() {
    const { data } = await db.from('events').select('*');
    if (data) cachedEvents = data;
    renderCalendar(); 
}

async function saveEvent(dateStr, hourStr, text, color, bgImage) {
    if (text.trim() === '') {
        await db.from('events').delete().match({ event_date: dateStr, event_hour: hourStr });
    } else {
        await db.from('events').upsert(
            { event_date: dateStr, event_hour: hourStr, text: text, color: color, bg_image: bgImage },
            { onConflict: 'event_date, event_hour' }
        );
    }
    fetchEventsFromCloud(); 
}

function renderCalendar() {
    const grid = document.getElementById('calendar-grid');
    grid.innerHTML = ''; 

    if (currentViewMode === 'month') {
        renderMonthView(grid);
    } else {
        renderTimeGrid(grid);
    }
}

// NEW: Monthly View Logic
function renderMonthView(grid) {
    const year = currentViewDate.getFullYear();
    const month = currentViewDate.getMonth();
    
    document.getElementById('week-date-range').innerText = `${monthsEn[month]} ${year}`;

    // Month Headers
    for (let i = 0; i < 7; i++) {
        const header = document.createElement('div');
        header.className = 'grid-header-cell';
        header.innerHTML = `<div class="day-name" style="font-size:14px; font-weight:bold;">${daysEn[i]}</div>`;
        grid.appendChild(header);
    }

    // Days calculation
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    // Empty cells before the 1st
    for (let i = 0; i < firstDay; i++) {
        const cell = document.createElement('div');
        cell.className = 'month-cell';
        grid.appendChild(cell);
    }

    // Actual days
    for (let d = 1; d <= daysInMonth; d++) {
        const cell = document.createElement('div');
        cell.className = 'month-cell';
        cell.innerHTML = `<div class="month-cell-date">${d}</div>`;
        
        const dateStr = `${year}-${String(month+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
        
        // Find all events for this day and show tiny blocks
        const dayEvents = cachedEvents.filter(e => e.event_date === dateStr);
        dayEvents.forEach(ev => {
            const dot = document.createElement('div');
            dot.className = 'month-event-dot';
            if(ev.color) dot.style.backgroundColor = ev.color;
            dot.innerText = `${ev.event_hour} - ${ev.text}`;
            cell.appendChild(dot);
        });

        grid.appendChild(cell);
    }
}

// OLD: Daily/Weekly Grid
function renderTimeGrid(grid) {
    let numDays = currentViewMode === 'day' ? 1 : (currentViewMode === 'workweek' ? 5 : 7);
    const d = new Date(currentViewDate);
    if (currentViewMode !== 'day') {
        const day = d.getDay();
        d.setDate(d.getDate() - day + (day === 0 ? -6 : 1)); // Start on Monday
    }
    const startDate = new Date(d);
    
    // Set text display
    const end = new Date(startDate); end.setDate(end.getDate() + (numDays - 1));
    document.getElementById('week-date-range').innerText = numDays === 1 
        ? `${monthsEn[startDate.getMonth()]} ${startDate.getDate()}, ${startDate.getFullYear()}`
        : `${monthsEn[startDate.getMonth()]} ${startDate.getDate()}-${end.getDate()}, ${startDate.getFullYear()}`;

    // Top Left empty
    const tlCell = document.createElement('div');
    tlCell.className = 'grid-header-cell time-col';
    grid.appendChild(tlCell);

    // Day Headers
    for (let i = 0; i < numDays; i++) {
        const cellDate = new Date(startDate); cellDate.setDate(startDate.getDate() + i);
        const headerCell = document.createElement('div');
        headerCell.className = 'grid-header-cell';
        headerCell.innerHTML = `<div class="day-number">${String(cellDate.getDate()).padStart(2, '0')}</div><div class="day-name">${daysEn[cellDate.getDay()]}</div>`;
        grid.appendChild(headerCell);
    }

    // Time Grid
    for (let h = 0; h < 24; h++) {
        const timeCell = document.createElement('div');
        timeCell.className = 'time-label';
        timeCell.innerText = String(h).padStart(2, '0') + ':00';
        grid.appendChild(timeCell);

        for (let d = 0; d < numDays; d++) {
            const cellDate = new Date(startDate); cellDate.setDate(startDate.getDate() + d);
            const dateStr = cellDate.toISOString().split('T')[0]; 
            const hourStr = String(h).padStart(2, '0');

            const cell = document.createElement('div');
            cell.className = 'grid-cell';

            cell.ondragover = (e) => { e.preventDefault(); cell.classList.add('drag-over'); };
            cell.ondragleave = (e) => { cell.classList.remove('drag-over'); };
            cell.ondrop = (e) => handleDrop(e, dateStr, hourStr, cell);

            const input = document.createElement('textarea');
            input.className = 'cell-input';
            
            const eventObj = cachedEvents.find(e => e.event_date === dateStr && e.event_hour === hourStr);
            if (eventObj) {
                input.value = eventObj.text || '';
                if (eventObj.color) cell.style.backgroundColor = applyTransparency(eventObj.color, 0.3);
                // Apply task image to the cell background!
                if (eventObj.bg_image) {
                    cell.style.backgroundImage = `url('${eventObj.bg_image}')`;
                }
            }

            input.addEventListener('change', (e) => {
                const exColor = eventObj ? eventObj.color : null;
                const exBg = eventObj ? eventObj.bg_image : null;
                saveEvent(dateStr, hourStr, e.target.value, exColor, exBg);
            });

            cell.appendChild(input);
            if (eventObj && input.value.trim() !== '') {
                const clearBtn = document.createElement('button');
                clearBtn.innerHTML = '×'; clearBtn.className = 'clear-cell-btn';
                clearBtn.onclick = () => saveEvent(dateStr, hourStr, '', null, null);
                cell.appendChild(clearBtn);
            }
            grid.appendChild(cell);
        }
    }
}

function applyTransparency(hex, alpha) {
    if(!hex || !hex.startsWith('#')) return '';
    let r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// --- 7. DRAG AND DROP ---
function handleDragStart(e, index) { e.dataTransfer.setData('text/plain', index); }

function handleDrop(e, dateStr, hourStr, cellElement) {
    e.preventDefault();
    cellElement.classList.remove('drag-over');
    
    const todoIndex = e.dataTransfer.getData('text/plain');
    if (todoIndex === '') return;

    const task = cachedTodos[todoIndex];
    const existingEvent = cachedEvents.find(ev => ev.event_date === dateStr && ev.event_hour === hourStr);
    const existingText = existingEvent ? existingEvent.text : "";
    const newText = existingText ? existingText + "\n" + task.text : task.text;
    
    // Carry over the color and image from the task!
    saveEvent(dateStr, hourStr, newText, task.color, task.bg_image);
}

// --- 8. TO-DOS ---
async function loadTodosFromCloud() {
    const { data } = await db.from('todos').select('*').order('created_at', { ascending: true });
    if (data) { cachedTodos = data; renderTodos(); }
}

function renderTodos() {
    const list = document.getElementById('todo-list');
    list.innerHTML = '';

    cachedTodos.forEach((todo, index) => {
        const li = document.createElement('li');
        li.style.borderLeftColor = todo.color || 'var(--primary-color)';
        if (todo.bg_image) li.style.backgroundImage = `url('${todo.bg_image}')`;
        
        li.draggable = true;
        li.ondragstart = (e) => handleDragStart(e, index);

        // Container to keep text readable over images
        const contentDiv = document.createElement('div');
        contentDiv.className = 'task-content';

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.checked = todo.completed;
        checkbox.onchange = () => toggleTodo(todo.id, todo.completed);

        const span = document.createElement('span');
        span.innerText = todo.text;
        if(todo.completed) span.style.textDecoration = "line-through";

        const delBtn = document.createElement('button');
        delBtn.innerHTML = '×';
        delBtn.className = 'delete-btn';
        delBtn.onclick = () => deleteTodo(todo.id);

        contentDiv.appendChild(checkbox);
        contentDiv.appendChild(span);
        contentDiv.appendChild(delBtn);
        li.appendChild(contentDiv);
        list.appendChild(li);
    });
}

function handleTodoKeyPress(e) { if (e.key === 'Enter') addTodo(); }

async function addTodo() {
    const input = document.getElementById('new-todo');
    const colorInput = document.getElementById('todo-color');
    const imageInput = document.getElementById('todo-image');
    const btn = document.getElementById('add-btn');
    
    const text = input.value.trim();
    if (text === '') return;

    btn.innerText = "..."; // Show loading state

    let uploadedImageUrl = null;
    if (imageInput.files.length > 0) {
        uploadedImageUrl = await uploadImageToSupabase(imageInput.files[0]);
    }

    await db.from('todos').insert({ 
        text: text, 
        color: colorInput.value, 
        completed: false,
        bg_image: uploadedImageUrl
    });
    
    input.value = '';
    imageInput.value = ''; // clear file
    btn.innerText = "+";
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

// --- 9. ADMIN ---
async function clearAllData() {
    if(confirm("ADMIN: Delete ALL data?")) {
        await db.from('events').delete().not('id', 'is', null);
        await db.from('todos').delete().not('id', 'is', null);
        await fetchEventsFromCloud();
        await loadTodosFromCloud();
    }
}