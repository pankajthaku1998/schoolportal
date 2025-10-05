// Firebase SDKs and Application Logic
// Note: This version loads Firebase via script tags to avoid CORS issues with file:// protocol

// --- GLOBAL VARIABLES & INITIALIZATION ---
let app, db, auth;
let currentUserId = null; // Internal Firebase UID
let currentUserData = null; // Stores all user data, including role and username

// Your Firebase Configuration
const firebaseConfig = {
    apiKey: "AIzaSyDNqtZ1LU-1Pj4GTkGzpXo7OyR4GYVimSk",
    authDomain: "school-management-system-13cda.firebaseapp.com",
    projectId: "school-management-system-13cda",
    storageBucket: "school-management-system-13cda.firebasestorage.app",
    messagingSenderId: "1042908188551",
    appId: "1:1042908188551:web:3ab46c1aa3da1048ee0d22",
    measurementId: "G-CEB4XQC6RT"
};

const appId = firebaseConfig.projectId;
const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;

// Static data structure
const ALL_CLASSES = ['LKG', 'UKG', '1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th'];
const MARK_CLASSES = ALL_CLASSES.slice(4); // 3rd to 8th (Indices 4 through 10)
const MARKS_CONFIG_CLASSES = ['3rd', '4th', '5th', '6th', '7th', '8th']; // Classes with configurable marks
const SUBJECTS = {
    'LKG': ['Hindi', 'English', 'Maths','Fun With Colour'], 
    'UKG': ['Hindi', 'English', 'Maths','Fun With Colour'],
    '1st': ['Hindi', 'English', 'Maths', 'EVS'], 
    '2nd': ['Hindi', 'English', 'Maths', 'EVS'],
    '3rd': ['Hindi', 'English', 'Maths', 'Science', 'Social Science'], 
    '4th': ['Hindi', 'English', 'Maths', 'Science', 'Social Science'],
    '5th': ['Hindi', 'English', 'Maths', 'Science', 'Social Science', 'Sanskrit'], 
    '6th': ['Hindi', 'English', 'Maths', 'Science', 'Social Science', 'Sanskrit'],
    '8th': ['Hindi', 'English', 'Maths', 'Science', 'Social Science', 'Sanskrit'],
};
const EXAM_TYPES = ['PT-1', 'Half Yearly', 'IA 1', 'PT-2', 'Annual', 'IA 2'];

// State storage for application data
let userList = {}; // Mapped by internal Firebase UID
let teachers = []; // Array of teacher objects
let students = []; // Array of student objects
let allotments = [];
let homeworks = [];
let marks = [];
let notifications = []; // Array of notification objects
let notificationReads = []; // Array of notification read records
let maxMarksConfig = {}; // Stores class-specific max marks configuration: {classId: {examType: maxMarks}}
let activeAdminTab = 'add-users'; // 'add-users', 'users', or 'marks-config'
let activeStudentTab = 'homework'; // 'homework' or 'marksheet'
let activeTeacherTab = 'homework'; // 'homework' or 'marks'

// --- FIRESTORE PATHS ---
const getPublicCollection = (name) => `artifacts/${appId}/public/data/${name}`;

const USERS_LIST_COLLECTION_PATH = getPublicCollection('user_list');
const ALLOTMENTS_COLLECTION_PATH = getPublicCollection('teacher_allotments');
const HOMEWORK_COLLECTION_PATH = getPublicCollection('homework');
const MARKS_COLLECTION_PATH = getPublicCollection('marks');
const MAX_MARKS_COLLECTION_PATH = getPublicCollection('max_marks_config');
const NOTIFICATIONS_COLLECTION_PATH = getPublicCollection('notifications');
const NOTIFICATION_READS_COLLECTION_PATH = getPublicCollection('notification_reads');

// --- UTILITY FUNCTIONS ---
window.showNotificationModal = (title, message) => {
    document.getElementById('modal-title').textContent = title;
    document.getElementById('modal-message').textContent = message;
    document.getElementById('notification-modal').classList.remove('hidden');
};

window.hideNotificationModal = () => {
    document.getElementById('notification-modal').classList.add('hidden');
};

// Helper function to refresh icons
const refreshIcons = () => {
    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }
};

const getSubjectsForClass = (classId) => SUBJECTS[classId] || [];

const calculateGrade = (percentage) => {
    if (percentage >= 90) return 'A1';
    if (percentage >= 80) return 'A2';
    if (percentage >= 70) return 'B1';
    if (percentage >= 60) return 'B2';
    if (percentage >= 50) return 'C1';
    if (percentage >= 40) return 'D';
    return 'F';
};

const generateUID = (role) => `${role.toUpperCase().slice(0, 3)}${Date.now().toString(36)}${Math.random().toString(36).substring(2, 5).toUpperCase()}`;

/**
 * Generates a concise summary of a teacher's allotments.
 */
const getAllotmentSummary = (teacherUid) => {
    const teacherAllotments = allotments.filter(a => a.teacherId === teacherUid);
    if (teacherAllotments.length === 0) {
        return '<span class="text-red-500 font-medium">None Allotted</span>';
    }

    // Group by class
    const grouped = teacherAllotments.reduce((acc, curr) => {
        if (!acc[curr.class]) acc[curr.class] = [];
        acc[curr.class].push(curr.subject);
        return acc;
    }, {});

    // Format for display
    return Object.entries(grouped).map(([classId, subjects]) => 
        `<div class="mt-1"><span class="font-semibold text-primary">${classId}:</span> <span class="text-gray-700">${subjects.join(', ')}</span></div>`
    ).join('');
};

// --- FIREBASE INITIALIZATION & AUTHENTICATION ---
const initializeFirebase = async () => {
    const loadingText = document.getElementById('loading-text');
    loadingText.textContent = "Connecting to Firebase...";
    
    try {
        if (!app) {
            // Initialize Firebase using compat version
            app = firebase.initializeApp(firebaseConfig);
            db = firebase.firestore();
            auth = firebase.auth();
            console.log('Firebase initialized successfully');
        }

        return new Promise(async (resolve, reject) => {
            const unsubscribe = auth.onAuthStateChanged(async (user) => {
                if (user) {
                    currentUserId = user.uid;
                    loadingText.textContent = `Authenticated. Loading user data...`;
                    console.log('User authenticated:', user.uid);
                    resolve();
                } else {
                    try {
                        loadingText.textContent = "Signing in anonymously...";
                        if (initialAuthToken) {
                            await auth.signInWithCustomToken(initialAuthToken);
                        } else {
                            await auth.signInAnonymously();
                        }
                    } catch (e) {
                        console.error("Authentication failed:", e);
                        reject(new Error(`Authentication failed: ${e.message}`));
                    }
                }
                if (currentUserId) unsubscribe(); 
            });
        });

    } catch (error) {
        console.error("Firebase Initialization Error:", error);
        loadingText.textContent = `Error: Failed to connect to Firebase. ${error.message}`;
        document.getElementById('loading-spinner').classList.add('hidden');
        throw error;
    }
};

const initializeAdminUser = async () => {
    const mockAdminId = 'ADM_12345';
    const adminDocRef = db.collection(USERS_LIST_COLLECTION_PATH).doc(mockAdminId);
    const adminData = {
        uid: mockAdminId,
        name: 'System Admin',
        role: 'admin',
        username: 'admin', // LOGIN USERNAME
        loginPassword: 'admin', // LOGIN PASSWORD
        email: 'admin@school.edu'
    };
    try {
        await adminDocRef.set(adminData, { merge: true });
        console.log("System Admin initialized successfully.");
        
        // Initialize default max marks configuration if not exists
        await initializeMaxMarksConfig();
    } catch (error) {
        console.error("Failed to initialize System Admin:", error);
        showNotificationModal("Database Error", "Failed to create initial admin user. Check Firestore security rules.");
    }
};

const initializeMaxMarksConfig = async () => {
    try {
        const defaultMaxMarks = {
            'PT-1': 20,
            'Half Yearly': 80,
            'IA 1': 10,
            'PT-2': 20,
            'Annual': 80,
            'IA 2': 10
        };
        
        // Initialize class-specific max marks for each configurable class
        for (const classId of MARKS_CONFIG_CLASSES) {
            for (const [examType, maxMarks] of Object.entries(defaultMaxMarks)) {
                const configDocId = `${classId}_${examType}`;
                const configDocRef = db.collection(MAX_MARKS_COLLECTION_PATH).doc(configDocId);
                const configDoc = await configDocRef.get();
                
                if (!configDoc.exists) {
                    await configDocRef.set({
                        classId: classId,
                        examType: examType,
                        maxMarks: maxMarks,
                        createdAt: new Date().toISOString()
                    });
                    console.log(`Initialized max marks for ${classId} - ${examType}: ${maxMarks}`);
                }
            }
        }
    } catch (error) {
        console.error("Failed to initialize max marks configuration:", error);
    }
};

// Initialize the application when the page loads
document.addEventListener('DOMContentLoaded', async () => {
    try {
        await initializeFirebase();
        await loadAndListen();
    } catch (error) {
        console.error('Application initialization failed:', error);
        const loadingText = document.getElementById('loading-text');
        if (loadingText) {
            loadingText.textContent = 'Application failed to initialize. Please refresh the page.';
        }
    }
});

// Make functions available globally
window.showRoleSelector = () => {
    currentUserId = null;
    currentUserData = null;
    
    // Show header on login page with school branding
    document.getElementById('header').classList.remove('hidden');
    
    // Hide user dropdown on login page
    document.querySelector('.user-dropdown').classList.add('hidden');
    
    document.getElementById('content-panel').innerHTML = `
        <div class="flex items-center justify-center min-h-[70vh]">
            <div class="w-full max-w-md bg-white p-8 rounded-xl shadow-2xl border border-gray-100">
                <div class="text-center mb-6">
                   <img src="./assets/images/logo.png" alt="School Logo" style="height: 70px; width: 70px; margin: auto;">
                    <h2 class="text-2xl font-bold text-primary mb-2">Welcome Back</h2>
                    <p class="text-gray-600 text-sm">Sign in to access your school portal</p>
                </div>
                
                <div id="login-status" class="text-sm text-center text-red-500 mb-4 hidden"></div>
                
                <form onsubmit="event.preventDefault(); handleLogin();">
                    <div class="mb-4">
                        <label for="username-input" class="block text-sm font-medium text-gray-700 mb-2">Username (ID / Admission No.)</label>
                        <input type="text" id="username-input" class="w-full p-3 border border-gray-300 rounded-lg shadow-sm focus:border-primary focus:ring focus:ring-primary focus:ring-opacity-50 transition duration-150" placeholder="Enter Username" required>
                    </div>
                    <div class="mb-6">
                        <label for="password-input" class="block text-sm font-medium text-gray-700 mb-2">Password</label>
                        <input type="password" id="password-input" class="w-full p-3 border border-gray-300 rounded-lg shadow-sm focus:border-primary focus:ring focus:ring-primary focus:ring-opacity-50 transition duration-150" placeholder="Enter password" required>
                    </div>
                    <button type="submit" class="w-full bg-primary text-white font-semibold py-3 px-4 rounded-lg shadow-lg hover:bg-indigo-600 transition duration-150 flex items-center justify-center">
                        <i data-lucide="log-in" class="w-4 h-4 mr-2"></i>
                        Sign In to Portal
                    </button>
                </form>
            </div>
        </div>
    `;
    
    // Initialize icons for the login page
    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }
};

// Login functionality for demo version
window.handleLogin = () => {
    const username = document.getElementById('username-input').value.trim();
    const password = document.getElementById('password-input').value;
    const statusDiv = document.getElementById('login-status');
    
    statusDiv.classList.add('hidden');
    
    if (!username || !password) {
        statusDiv.textContent = 'Please enter both username and password.';
        statusDiv.classList.remove('hidden');
        return;
    }

    // Find user by username and loginPassword
    const user = Object.values(userList).find(u => u.username === username && u.loginPassword === password);

    if (user) {
        currentUserId = user.uid;
        currentUserData = user;

        updateHeader(user);
        showDashboard(user);
    } else {
        showNotificationModal('Login Failed', 'Invalid username or password.');
    }
};

// Update header with user information
const updateHeader = (user) => {
    // Update role title
    document.getElementById('role-title').textContent = `${user.role.charAt(0).toUpperCase() + user.role.slice(1)} Panel`;
    
    // Update user display name (clean, no extra info)
    document.getElementById('display-name').textContent = user.name;
    document.getElementById('user-role').textContent = user.role.charAt(0).toUpperCase() + user.role.slice(1);
    
    // Update user initials for avatar
    const initials = user.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
    document.getElementById('user-initials').textContent = initials;
    
    // Show header and user dropdown for authenticated users
    document.getElementById('header').classList.remove('hidden');
    document.querySelector('.user-dropdown').classList.remove('hidden');
    
    if (typeof lucide !== 'undefined') {
        lucide.createIcons(); // Initialize icons
    }
};

// Show appropriate dashboard based on user role
const showDashboard = (user) => {
    const contentPanel = document.getElementById('content-panel');
    
    if (user.role === 'admin') {
        renderAdminPanel();
    } else if (user.role === 'teacher') {
        renderTeacherPanel();
    } else if (user.role === 'student') {
        renderStudentPanel();
    }
    
    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }
};

// --- ADMIN PANEL FUNCTIONS ---
const renderAdminPanel = () => {
    const panel = document.getElementById('content-panel');
    panel.innerHTML = `
        <!-- Admin Panel Tabs Only -->
        <div class="admin-tabs-container">
            <div class="grid grid-cols-2 md:grid-cols-4 gap-3 max-w-4xl mx-auto">
                <button data-tab-name="add-users" onclick="openAdminSection('add-users')" class="admin-tab-card bg-blue-500 hover:bg-blue-600 text-white p-4 rounded-lg shadow-lg transition-all duration-300 transform hover:scale-105">
                    <div class="flex flex-col items-center">
                        <i data-lucide="user-plus" class="w-8 h-8 mb-2"></i>
                        <h3 class="text-lg font-semibold mb-1">Add Users</h3>
                        <p class="text-blue-100 text-sm">Add new students & teachers</p>
                    </div>
                </button>
                
                <button data-tab-name="users" onclick="openAdminSection('users')" class="admin-tab-card bg-green-500 hover:bg-green-600 text-white p-4 rounded-lg shadow-lg transition-all duration-300 transform hover:scale-105">
                    <div class="flex flex-col items-center">
                        <i data-lucide="users" class="w-8 h-8 mb-2"></i>
                        <h3 class="text-lg font-semibold mb-1">Manage Users</h3>
                        <p class="text-green-100 text-sm">${teachers.length + students.length} total users</p>
                    </div>
                </button>
                
                <button data-tab-name="notifications" onclick="openAdminSection('notifications')" class="admin-tab-card bg-purple-500 hover:bg-purple-600 text-white p-4 rounded-lg shadow-lg transition-all duration-300 transform hover:scale-105">
                    <div class="flex flex-col items-center">
                        <i data-lucide="bell" class="w-8 h-8 mb-2"></i>
                        <h3 class="text-lg font-semibold mb-1">Notifications</h3>
                        <p class="text-purple-100 text-sm">${notifications.length} notifications</p>
                    </div>
                </button>
                
                <button data-tab-name="marks-config" onclick="openAdminSection('marks-config')" class="admin-tab-card bg-orange-500 hover:bg-orange-600 text-white p-4 rounded-lg shadow-lg transition-all duration-300 transform hover:scale-105">
                    <div class="flex flex-col items-center">
                        <i data-lucide="settings" class="w-8 h-8 mb-2"></i>
                        <h3 class="text-lg font-semibold mb-1">Marks Config</h3>
                        <p class="text-orange-100 text-sm">Configure exam marks</p>
                    </div>
                </button>
            </div>
        </div>

        <!-- Add Users Section -->
        <div id="add-users-section" class="form-section hidden">
            <h3>Add New User to System</h3>
            <div class="max-w-md mx-auto">
                <form id="add-user-form" onsubmit="event.preventDefault(); handleAddUser(this);">
                    <div class="mb-4">
                        <label for="user-name" class="block text-sm font-medium text-gray-700 mb-2">Full Name</label>
                        <input type="text" id="user-name" name="user-name" required class="form-input w-full">
                    </div>
                    
                    <!-- Professional Role Toggle Switch -->
                    <div class="mb-6">
                        <label class="block text-sm font-medium text-gray-700 mb-3">User Type</label>
                        <div class="flex justify-center">
                            <div class="relative">
                                <input type="checkbox" id="user-role-toggle" class="sr-only" onchange="toggleUserRole()">
                                <div class="role-toggle-container">
                                    <div class="role-toggle-option teacher" onclick="setTeacherMode()">
                                        <i data-lucide="graduation-cap" class="w-4 h-4 mr-2"></i>
                                        Teacher
                                    </div>
                                    <div class="role-toggle-option student" onclick="setStudentMode()">
                                        <i data-lucide="user" class="w-4 h-4 mr-2"></i>
                                        Student
                                    </div>
                                    <div class="role-toggle-slider"></div>
                                </div>
                            </div>
                        </div>
                        <input type="hidden" id="user-role" name="user-role" value="student">
                    </div>
                    <div class="mb-4">
                        <label for="user-username" class="block text-sm font-medium text-gray-700 mb-2" id="username-label">Student Admission No.</label>
                        <input type="text" id="user-username" name="user-username" required class="form-input w-full" placeholder="ADM-2024-001">
                    </div>
                    
                    <div id="student-class-field" class="mb-4">
                        <label for="student-class" class="block text-sm font-medium text-gray-700 mb-2">Student Class</label>
                        <select id="student-class" name="student-class" class="form-select w-full">
                            <option value="" disabled selected>Select Class</option>
                            ${ALL_CLASSES.map(c => `<option value="${c}">${c}</option>`).join('')}
                        </select>
                    </div>
                    
                    <div class="mb-6">
                        <label for="user-password" class="block text-sm font-medium text-gray-700 mb-2">Temporary Password</label>
                        <input type="text" id="user-password" name="user-password" required value="123456" class="form-input w-full">
                    </div>
                    
                    <button type="submit" class="btn-primary w-full flex items-center justify-center">
                        <i data-lucide="user-plus" class="w-4 h-4 mr-2"></i>
                        <span id="submit-button-text">Add Student to System</span>
                    </button>
                </form>
            </div>
        </div>

        <!-- Users Management Section -->
        <div id="users-section" class="bg-white p-6 rounded-xl shadow-lg border border-gray-100 hidden">
            <h3 class="text-xl font-semibold text-gray-800 mb-6 border-b pb-3 flex items-center">
                <i data-lucide="users" class="w-5 h-5 mr-2"></i>
                Users Management (${teachers.length} Teachers, ${students.length} Students)
            </h3>
            
            <!-- Search Bar -->
            <div class="mb-6">
                <div class="relative max-w-md">
                    <input type="text" id="user-search" onkeyup="filterUsers()" placeholder="Search by Name or Username (ID)..." class="w-full p-3 border border-gray-300 rounded-lg shadow-sm focus:border-primary focus:ring focus:ring-primary focus:ring-opacity-50 transition duration-150 pl-10">
                    <i data-lucide="search" class="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400"></i>
                </div>
            </div>

            <!-- User Type Tabs -->
            <div class="flex border-b border-gray-300 mb-4">
                <button data-tab-name="teachers" onclick="switchUserTab('teachers')" class="user-tab-button flex items-center justify-center flex-1 py-3 px-4 rounded-t-lg text-sm font-medium transition duration-150 bg-white border-b-4 border-primary font-bold">
                    <i data-lucide="graduation-cap" class="w-4 h-4 mr-2"></i> Teachers (${teachers.length})
                </button>
                <button data-tab-name="students" onclick="switchUserTab('students')" class="user-tab-button flex items-center justify-center flex-1 py-3 px-4 rounded-t-lg text-sm font-medium transition duration-150 bg-gray-200 text-gray-600 hover:bg-gray-100 border-b-2 border-gray-200">
                    <i data-lucide="user" class="w-4 h-4 mr-2"></i> Students (${students.length})
                </button>
            </div>
            
            <!-- User Lists -->
            <div class="bg-gray-50 p-4 rounded-lg">
                <!-- Teacher List Wrapper -->
                <div id="teacher-list-wrapper" class="admin-list-scroll scroll-panel">
                    <div id="teacher-list-container">
                        <!-- Teacher table generated by renderUserTables -->
                    </div>
                </div>

                <!-- Student List Wrapper -->
                <div id="student-list-wrapper" class="admin-list-scroll scroll-panel hidden">
                    <div id="student-list-container">
                        <!-- Student table generated by renderUserTables -->
                    </div>
                </div>
            </div>
        </div>
        
        <!-- Marks Configuration Section -->
        <div id="marks-config-section" class="bg-white p-6 rounded-xl shadow-lg border border-gray-100 hidden">
            <h3 class="text-xl font-semibold text-gray-800 mb-6 border-b pb-3 flex items-center">
                <i data-lucide="settings" class="w-5 h-5 mr-2"></i>
                Class-wise Max Marks Configuration
            </h3>
            
            <div class="bg-gradient-to-r from-blue-50 to-indigo-50 p-6 rounded-lg border border-blue-200">
                <!-- Class Selection -->
                <div class="mb-6">
                    <label for="config-class-select" class="block text-sm font-medium text-gray-700 mb-2">Select Class to Configure</label>
                    <select id="config-class-select" class="w-full max-w-md p-3 border border-gray-300 rounded-lg shadow-sm focus:border-primary focus:ring focus:ring-primary focus:ring-opacity-50 transition duration-150" onchange="updateMarksConfigDisplay()">
                        <option value="" disabled selected>Choose a class to configure marks</option>
                        ${MARKS_CONFIG_CLASSES.map(classId => `<option value="${classId}">${classId} Class</option>`).join('')}
                    </select>
                </div>
                
                <!-- Max Marks Configuration Grid -->
                <div id="marks-config-grid" class="hidden">
                    <h4 class="text-lg font-semibold text-gray-800 mb-4">Exam Max Marks for <span id="selected-class-name" class="text-primary"></span></h4>
                    <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                        ${EXAM_TYPES.map(examType => `
                            <div class="bg-white p-4 rounded-lg border border-gray-300 shadow-sm">
                                <label for="class-max-marks-${examType}" class="block text-sm font-medium text-gray-700 mb-2">${examType}</label>
                                <input 
                                    type="number" 
                                    id="class-max-marks-${examType}" 
                                    value="0"
                                    min="1" 
                                    max="100" 
                                    class="w-full p-3 border border-gray-300 rounded-lg text-center font-semibold focus:border-primary focus:ring focus:ring-primary focus:ring-opacity-50"
                                    onchange="updateClassSpecificMaxMarks('${examType}', this.value)"
                                >
                                <p class="text-xs text-gray-500 mt-1 text-center">Max Marks</p>
                            </div>
                        `).join('')}
                    </div>
                    <div class="p-4 bg-green-50 border border-green-200 rounded-lg">
                        <p class="text-sm text-green-800 flex items-center">
                            <i data-lucide="check-circle" class="w-4 h-4 mr-2"></i>
                            <strong>Note:</strong> Changes will be applied immediately to teacher marks entry and student marksheets for this class.
                        </p>
                    </div>
                </div>
            </div>
            
            <!-- Import Students Section -->
            <div id="import-students-section" class="bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 p-8 rounded-xl shadow-xl border-2 border-indigo-200 mt-6">
                <div class="flex items-center justify-between mb-6 border-b-2 border-indigo-300 pb-4">
                    <h3 class="text-2xl font-bold text-gray-800 flex items-center">
                        <i data-lucide="file-spreadsheet" class="w-7 h-7 mr-3 text-indigo-600"></i>
                        Bulk Import Students from Excel
                    </h3>
                    <div class="bg-indigo-600 text-white px-4 py-2 rounded-full text-sm font-semibold shadow-md">
                        <i data-lucide="zap" class="w-4 h-4 inline mr-1"></i>
                        Quick Import
                    </div>
                </div>
                
                <!-- Instructions Card -->
                <div class="bg-white rounded-lg shadow-md p-6 mb-6 border border-gray-200">
                    <h4 class="text-lg font-semibold text-gray-800 mb-3 flex items-center">
                        <i data-lucide="info" class="w-5 h-5 mr-2 text-blue-600"></i>
                        How to Import Students
                    </h4>
                    <ol class="list-decimal list-inside space-y-2 text-sm text-gray-700">
                        <li><strong>Download the sample Excel template</strong> using the button below</li>
                        <li><strong>Fill in student details</strong> with the required columns:
                            <ul class="list-disc list-inside ml-6 mt-1 space-y-1">
                                <li><span class="font-semibold text-primary">name</span> - Full name of the student</li>
                                <li><span class="font-semibold text-primary">username</span> - Admission number (must be unique)</li>
                                <li><span class="font-semibold text-primary">class</span> - Student's class (${ALL_CLASSES.join(', ')})</li>
                                <li><span class="font-semibold text-primary">loginPassword</span> - Login password (optional, defaults to 123456)</li>
                            </ul>
                        </li>
                        <li><strong>Upload the file</strong> and click Import Students</li>
                    </ol>
                </div>
                
                <!-- Action Area -->
                <div class="bg-white rounded-lg shadow-md p-6 border border-gray-200">
                    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <!-- Left Column: File Upload -->
                        <div>
                            <label class="block text-sm font-semibold text-gray-700 mb-3">
                                <i data-lucide="upload-cloud" class="w-4 h-4 inline mr-1"></i>
                                Select Excel File
                            </label>
                            <div class="border-2 border-dashed border-indigo-300 rounded-lg p-6 bg-indigo-50 hover:bg-indigo-100 transition duration-200">
                                <input type="file" id="student-excel-file" accept=".xlsx,.xls" class="block w-full text-sm text-gray-700 file:mr-4 file:py-3 file:px-6 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-indigo-600 file:text-white hover:file:bg-indigo-700 file:cursor-pointer file:shadow-md transition duration-150" />
                                <p class="text-xs text-gray-500 mt-2">Supported formats: .xlsx, .xls</p>
                            </div>
                        </div>
                        
                        <!-- Right Column: Actions -->
                        <div class="flex flex-col justify-center space-y-4">
                            <button type="button" onclick="handleDownloadStudentSample()" class="w-full bg-gradient-to-r from-gray-600 to-gray-700 hover:from-gray-700 hover:to-gray-800 text-white px-6 py-4 rounded-lg font-semibold flex items-center justify-center shadow-lg transition duration-200 transform hover:scale-105">
                                <i data-lucide="download" class="w-5 h-5 mr-2"></i>
                                Download Sample Excel Template
                            </button>
                            <button type="button" onclick="handleImportStudentsFromExcel()" class="w-full bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 text-white px-6 py-4 rounded-lg font-semibold flex items-center justify-center shadow-lg transition duration-200 transform hover:scale-105">
                                <i data-lucide="users" class="w-5 h-5 mr-2"></i>
                                Import Students to System
                            </button>
                        </div>
                    </div>
                </div>
                
                <!-- Tips & Warnings -->
                <div class="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div class="bg-blue-100 border-l-4 border-blue-600 p-4 rounded-r-lg">
                        <div class="flex items-start">
                            <i data-lucide="lightbulb" class="w-5 h-5 text-blue-700 mr-2 mt-0.5"></i>
                            <div>
                                <p class="font-semibold text-blue-900 text-sm">Pro Tip</p>
                                <p class="text-blue-800 text-xs mt-1">Class names must exactly match: ${ALL_CLASSES.join(', ')}</p>
                            </div>
                        </div>
                    </div>
                    <div class="bg-amber-100 border-l-4 border-amber-600 p-4 rounded-r-lg">
                        <div class="flex items-start">
                            <i data-lucide="alert-triangle" class="w-5 h-5 text-amber-700 mr-2 mt-0.5"></i>
                            <div>
                                <p class="font-semibold text-amber-900 text-sm">Important</p>
                                <p class="text-amber-800 text-xs mt-1">Duplicate usernames will be skipped during import</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
        
        <!-- Notifications Management Section -->
        <div id="notifications-section" class="bg-white p-6 rounded-xl shadow-lg border border-gray-100 hidden">
            <h3 class="text-xl font-semibold text-gray-800 mb-6 border-b pb-3 flex items-center">
                <i data-lucide="bell" class="w-5 h-5 mr-2"></i>
                Notifications Management
            </h3>
            
            <!-- Add Notification Form -->
            <div class="mb-8 bg-gradient-to-r from-blue-50 to-indigo-50 p-6 rounded-lg border border-blue-200">
                <h4 class="text-lg font-semibold text-gray-800 mb-4">Create New Notification</h4>
                <form id="notification-form" onsubmit="event.preventDefault(); handleAddNotification(this);">
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                        <div>
                            <label for="notification-title" class="block text-sm font-medium text-gray-700 mb-2">Title</label>
                            <input type="text" id="notification-title" required class="w-full p-3 border border-gray-300 rounded-lg focus:border-primary focus:ring focus:ring-primary focus:ring-opacity-50" placeholder="Enter notification title">
                        </div>
                        <div>
                            <label for="notification-target" class="block text-sm font-medium text-gray-700 mb-2">Target Audience</label>
                            <select id="notification-target" required class="w-full p-3 border border-gray-300 rounded-lg focus:border-primary focus:ring focus:ring-primary focus:ring-opacity-50">
                                <option value="" disabled selected>Select Target</option>
                                <option value="all">All Users</option>
                                <option value="teachers">Teachers Only</option>
                                <option value="students">Students Only</option>
                            </select>
                        </div>
                    </div>
                    <div class="mb-4">
                        <label for="notification-content" class="block text-sm font-medium text-gray-700 mb-2">Content</label>
                        <textarea id="notification-content" required rows="4" class="w-full p-3 border border-gray-300 rounded-lg focus:border-primary focus:ring focus:ring-primary focus:ring-opacity-50" placeholder="Enter notification content..."></textarea>
                    </div>
                    <div class="mb-4">
                        <label for="notification-priority" class="block text-sm font-medium text-gray-700 mb-2">Priority</label>
                        <select id="notification-priority" required class="w-full p-3 border border-gray-300 rounded-lg focus:border-primary focus:ring focus:ring-primary focus:ring-opacity-50">
                            <option value="normal">Normal</option>
                            <option value="important">Important</option>
                            <option value="urgent">Urgent</option>
                        </select>
                    </div>
                    <button type="submit" class="w-full bg-secondary text-white font-semibold py-3 rounded-lg hover:bg-emerald-600 transition duration-150 shadow-md flex items-center justify-center">
                        <i data-lucide="bell-plus" class="w-4 h-4 mr-2"></i>
                        Create Notification
                    </button>
                </form>
            </div>
            
            <!-- Existing Notifications List -->
            <div>
                <h4 class="text-lg font-semibold text-gray-800 mb-4">Existing Notifications</h4>
                <div id="admin-notifications-list" class="space-y-4">
                    ${renderAdminNotificationsList()}
                </div>
            </div>
        </div>
    `;
    
    // Initialize user tables
    renderUserTables(teachers, students);
    
    // Initialize toggle switch after DOM is ready
    setTimeout(() => {
        const toggle = document.getElementById('user-role-toggle');
        if (toggle) {
            // Set default to student (checked = true)
            toggle.checked = true;
            // Initialize the form state
            toggleUserRole();
            console.log('✅ Toggle switch initialized to student mode');
        } else {
            console.error('❌ Toggle switch element not found');
        }
    }, 200);
    
    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }
};

// New function to open admin sections
window.openAdminSection = (section) => {
    const panel = document.getElementById('content-panel');
    
    // Hide the tabs container
    const tabsContainer = document.querySelector('.admin-tabs-container');
    if (tabsContainer) {
        tabsContainer.classList.add('hidden');
    }
    
    // Show back button and section title
    const backButton = `
        <div class="mb-6">
            <button onclick="showAdminTabs()" class="btn-secondary flex items-center mb-4">
                <i data-lucide="arrow-left" class="w-4 h-4 mr-2"></i>
                Back to Admin Panel
            </button>
        </div>
    `;
    
    // Show the selected section
    document.getElementById('add-users-section')?.classList.add('hidden');
    document.getElementById('users-section')?.classList.add('hidden');
    document.getElementById('notifications-section')?.classList.add('hidden');
    document.getElementById('marks-config-section')?.classList.add('hidden');
    
    const targetSection = document.getElementById(`${section}-section`);
    if (targetSection) {
        targetSection.classList.remove('hidden');
        // Add back button to the section
        if (!targetSection.querySelector('.back-button-container')) {
            targetSection.insertAdjacentHTML('afterbegin', `<div class="back-button-container">${backButton}</div>`);
        }
    }
    
    // Initialize toggle switch if it's the add-users section
    if (section === 'add-users') {
        setTimeout(() => {
            const toggle = document.getElementById('user-role-toggle');
            if (toggle) {
                toggle.checked = true;
                toggleUserRole();
            }
        }, 100);
    }
    
    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }
};

// Function to show admin tabs again
window.showAdminTabs = () => {
    const tabsContainer = document.querySelector('.admin-tabs-container');
    if (tabsContainer) {
        tabsContainer.classList.remove('hidden');
    }
    
    // Hide all sections
    document.getElementById('add-users-section')?.classList.add('hidden');
    document.getElementById('users-section')?.classList.add('hidden');
    document.getElementById('notifications-section')?.classList.add('hidden');
    document.getElementById('marks-config-section')?.classList.add('hidden');
    
    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }
};

// Legacy tab switching function (kept for compatibility)
window.switchTab = (tab) => {
    openAdminSection(tab);
};

window.switchUserTab = (userType) => {
    // Update button styling for user tabs
    document.querySelectorAll('.user-tab-button').forEach(btn => {
        if (btn.dataset.tabName === userType) {
            btn.classList.replace('bg-gray-200', 'bg-white');
            btn.classList.add('border-b-4', 'border-primary', 'font-bold');
            btn.classList.remove('text-gray-600', 'hover:bg-gray-100', 'border-b-2', 'border-gray-200', 'font-medium');
        } else {
            btn.classList.replace('bg-white', 'bg-gray-200');
            btn.classList.remove('border-b-4', 'border-primary', 'font-bold');
            btn.classList.add('text-gray-600', 'hover:bg-gray-100', 'border-b-2', 'border-gray-200', 'font-medium');
        }
    });

    // Update user list visibility
    document.getElementById('teacher-list-wrapper')?.classList.toggle('hidden', userType !== 'teachers');
    document.getElementById('student-list-wrapper')?.classList.toggle('hidden', userType !== 'students');
    
    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }
};

// Helper functions for toggle clicks
window.setTeacherMode = () => {
    const toggle = document.getElementById('user-role-toggle');
    if (toggle) {
        toggle.checked = false;
        toggleUserRole();
    }
};

window.setStudentMode = () => {
    const toggle = document.getElementById('user-role-toggle');
    if (toggle) {
        toggle.checked = true;
        toggleUserRole();
    }
};

// Updated toggle function for the professional switch
window.toggleUserRole = () => {
    const toggle = document.getElementById('user-role-toggle');
    const roleInput = document.getElementById('user-role');
    const classField = document.getElementById('student-class-field');
    const classSelect = document.getElementById('student-class');
    const usernameLabel = document.getElementById('username-label');
    const submitButtonText = document.getElementById('submit-button-text');
    const usernameInput = document.getElementById('user-username');
    const toggleContainer = document.querySelector('.role-toggle-container');
    
    if (!toggle || !roleInput) return;
    
    const isStudent = toggle.checked;
    
    // Update hidden role input
    roleInput.value = isStudent ? 'student' : 'teacher';
    
    // Update toggle visual state
    if (toggleContainer) {
        if (isStudent) {
            toggleContainer.classList.add('student-mode');
        } else {
            toggleContainer.classList.remove('student-mode');
        }
    }
    
    // Update form fields based on role
    if (isStudent) {
        // Student mode
        classField?.classList.remove('hidden');
        if (classSelect) classSelect.required = true;
        if (usernameLabel) usernameLabel.textContent = 'Student Admission No.';
        if (usernameInput) usernameInput.placeholder = 'ADM-2024-001';
        if (submitButtonText) submitButtonText.textContent = 'Add Student to System';
    } else {
        // Teacher mode
        classField?.classList.add('hidden');
        if (classSelect) {
            classSelect.required = false;
            classSelect.value = '';
        }
        if (usernameLabel) usernameLabel.textContent = 'Teacher ID';
        if (usernameInput) usernameInput.placeholder = 'TID-001';
        if (submitButtonText) submitButtonText.textContent = 'Add Teacher to System';
    }
};

// Legacy function for compatibility
window.toggleStudentClassField = () => {
    // This function is now handled by toggleUserRole
    toggleUserRole();
};


// Helper function to generate table HTML for a given user array (teachers or students)
const generateUserTableHTML = (userArray) => {
    if (userArray.length === 0) {
        return `<p class="text-gray-500 p-4">No matching users found.</p>`;
    }
    
    // Filter out the 'admin' user from the display list if they somehow ended up here
    const displayUsers = userArray.filter(u => u.role !== 'admin');

    // Helper function to generate table rows
    const generateRows = displayUsers.sort((a,b) => a.name.localeCompare(b.name)).map(user => `
        <tr class="hover:bg-gray-50">
            <td class="px-3 py-2 whitespace-nowrap text-sm text-gray-900">${user.name}</td>
            <td class="px-3 py-2 whitespace-nowrap text-xs text-gray-500 font-mono">${user.username}</td>
            <!-- Updated cell to show allotment summary for teachers or class for students -->
            <td class="px-3 py-2 text-sm text-gray-700 align-top">
                ${user.role === 'teacher' 
                    ? getAllotmentSummary(user.uid) 
                    : `<span class="font-medium text-indigo-600">${user.class || 'N/A'}</span>`}
            </td>
            <!-- Updated Action buttons with styling -->
            <td class="px-3 py-2 whitespace-nowrap text-sm min-w-[280px] space-x-2">
                ${user.role === 'teacher' ? `
                    <button onclick="showTeacherUpdateModal('${user.uid}')" 
                        class="inline-flex items-center bg-accent hover:bg-amber-600 text-white font-semibold py-1 px-3 rounded-lg text-xs shadow-md transition duration-150">
                        <i data-lucide="blocks" class="w-3 h-3 inline-block mr-1"></i> Allot
                    </button>
                ` : ''}
                <button onclick="showUserEditModal('${user.uid}')" 
                    class="inline-flex items-center bg-primary hover:bg-indigo-600 text-white font-semibold py-1 px-3 rounded-lg text-xs shadow-md transition duration-150">
                    <i data-lucide="pencil" class="w-3 h-3 inline-block mr-1"></i> Edit
                </button>
                <button onclick="handleDeleteUser('${user.uid}', '${user.name}', '${user.role}')" 
                    class="inline-flex items-center bg-red-500 hover:bg-red-600 text-white font-semibold py-1 px-3 rounded-lg text-xs shadow-md transition duration-150">
                    <i data-lucide="trash-2" class="w-3 h-3 inline-block mr-1"></i> Delete
                </button>
            </td>
        </tr>
    `).join('');

    return `
        <table class="min-w-full divide-y divide-gray-200">
            <thead class="bg-gray-50 sticky top-0">
                <tr>
                    <th class="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                    <th class="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Username</th>
                    <!-- Updated Header Title -->
                    <th class="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-[40%]">Allotment / Class</th>
                    <th class="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
            </thead>
            <tbody class="bg-white divide-y divide-gray-200">
                ${generateRows}
            </tbody>
        </table>
    `;
};

// Function to render the user lists based on filtered data
const renderUserTables = (filteredTeachers, filteredStudents) => {
    const teacherContainer = document.getElementById('teacher-list-container');
    const studentContainer = document.getElementById('student-list-container');
    
    if (teacherContainer) {
        teacherContainer.innerHTML = generateUserTableHTML(filteredTeachers);
    }
    if (studentContainer) {
        studentContainer.innerHTML = generateUserTableHTML(filteredStudents);
    }

    // Update counts in buttons
    const teacherButton = document.querySelector('[data-tab-name="teachers"]');
    const studentButton = document.querySelector('[data-tab-name="students"]');
    
    if (teacherButton) {
        teacherButton.innerHTML = `<i data-lucide="graduation-cap" class="w-4 h-4 mr-2"></i> Teachers (${teachers.length})`;
    }
    if (studentButton) {
        studentButton.innerHTML = `<i data-lucide="user" class="w-4 h-4 mr-2"></i> Students (${students.length})`;
    }

    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }
};

// Search logic function
window.filterUsers = () => {
    const searchTerm = document.getElementById('user-search').value.toLowerCase().trim();
    
    // Filter by username or name
    const filteredTeachers = teachers.filter(t => 
        t.username.toLowerCase().includes(searchTerm) || t.name.toLowerCase().includes(searchTerm)
    );
    const filteredStudents = students.filter(s => 
        s.username.toLowerCase().includes(searchTerm) || s.name.toLowerCase().includes(searchTerm)
    );
    
    // Update tables with filtered results
    const teacherContainer = document.getElementById('teacher-list-container');
    const studentContainer = document.getElementById('student-list-container');

    if (teacherContainer) teacherContainer.innerHTML = generateUserTableHTML(filteredTeachers);
    if (studentContainer) studentContainer.innerHTML = generateUserTableHTML(filteredStudents);
    
    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }
};

// Add User Form Handler
window.handleAddUser = async (form) => {
    // Get form elements directly
    const nameElement = document.getElementById('user-name');
    const roleElement = document.getElementById('user-role');
    const usernameElement = document.getElementById('user-username');
    const passwordElement = document.getElementById('user-password');
    const studentClassElement = document.getElementById('student-class');

    // Extract values with validation and detailed debugging
    const name = nameElement ? nameElement.value.trim() : '';
    let role = '';
    
    // Try multiple ways to get the role value
    if (roleElement) {
        role = roleElement.value;
        console.log('Role from .value:', role);
        
        // If empty, try getting from selected option
        if (!role && roleElement.selectedIndex >= 0) {
            const selectedOption = roleElement.options[roleElement.selectedIndex];
            role = selectedOption ? selectedOption.value : '';
            console.log('Role from selected option:', role);
        }
        
        // If still empty, try form data
        if (!role) {
            const formData = new FormData(form);
            role = formData.get('user-role') || '';
            console.log('Role from FormData:', role);
        }
    }
    
    const username = usernameElement ? usernameElement.value.trim() : '';
    const password = passwordElement ? passwordElement.value : '';
    const studentClass = studentClassElement ? studentClassElement.value : '';

    console.log('=== ADD USER DEBUG ===');
    console.log('Form elements found:', {
        nameElement: !!nameElement,
        roleElement: !!roleElement,
        usernameElement: !!usernameElement,
        passwordElement: !!passwordElement,
        studentClassElement: !!studentClassElement
    });
    console.log('Values extracted:', { name, role, username, password, studentClass });
    console.log('Role element detailed info:', {
        element: !!roleElement,
        value: roleElement?.value,
        selectedIndex: roleElement?.selectedIndex,
        optionsLength: roleElement?.options?.length,
        selectedOption: roleElement?.selectedIndex >= 0 ? roleElement.options[roleElement.selectedIndex]?.value : 'none',
        allOptions: roleElement && roleElement.options ? Array.from(roleElement.options).map((o, i) => ({
            index: i,
            value: o.value,
            text: o.text,
            selected: o.selected
        })) : 'No options'
    });

    // Validate required fields
    if (!name) {
        showNotificationModal('Error', 'Please enter a name.');
        return;
    }
    
    if (!role) {
        showNotificationModal('Error', 'Please select a role.');
        return;
    }
    
    if (!username) {
        showNotificationModal('Error', 'Please enter a username.');
        return;
    }
    
    if (!password) {
        showNotificationModal('Error', 'Please enter a password.');
        return;
    }

    if (role === 'student' && !studentClass) {
        showNotificationModal('Error', 'Please select a class for the student.');
        return;
    }

    // Check if username already exists
    console.log('Checking existing users. UserList type:', typeof userList, 'UserList:', userList);
    let existingUser = null;
    try {
        if (userList && typeof userList === 'object') {
            existingUser = Object.values(userList).find(u => u && u.username === username);
        }
    } catch (error) {
        console.error('Error checking existing users:', error);
        console.log('UserList content:', userList);
    }
    
    if (existingUser) {
        showNotificationModal('Error', 'Username already exists. Please choose a different username.');
        return;
    }

    const uid = generateUID(role);
    const userData = {
        uid: uid,
        name: name,
        role: role,
        username: username,
        loginPassword: password,
        email: `${username}@school.edu`,
        createdAt: new Date().toISOString()
    };

    if (role === 'student') {
        userData.class = studentClass;
        console.log('Student data with class:', userData);
    }

    console.log('Final user data:', userData);

    try {
        await db.collection(USERS_LIST_COLLECTION_PATH).doc(uid).set(userData);
        showNotificationModal('Success', `${role.charAt(0).toUpperCase() + role.slice(1)} "${name}" has been added successfully!`);
        
        // Reset form
        form.reset();
        
        // Reset toggle to student mode (default)
        const toggle = document.getElementById('user-role-toggle');
        if (toggle) {
            toggle.checked = true;
            toggleUserRole();
        }
        
        // Force refresh of user lists
        setTimeout(() => {
            if (currentUserData && currentUserData.role === 'admin') {
                renderUserTables(teachers, students);
            }
        }, 1000);
        
    } catch (error) {
        console.error('Error adding user:', error);
        showNotificationModal('Error', `Failed to add user: ${error.message}`);
    }
};

// Marks Configuration Functions
window.updateMarksConfigDisplay = () => {
    const classSelect = document.getElementById('config-class-select');
    const configGrid = document.getElementById('marks-config-grid');
    const selectedClassName = document.getElementById('selected-class-name');
    
    if (classSelect.value) {
        selectedClassName.textContent = classSelect.value;
        configGrid.classList.remove('hidden');
        
        // Load existing max marks for this class
        const classConfig = maxMarksConfig[classSelect.value] || {};
        EXAM_TYPES.forEach(examType => {
            const input = document.getElementById(`class-max-marks-${examType}`);
            if (input) {
                input.value = classConfig[examType] || 0;
            }
        });
    } else {
        configGrid.classList.add('hidden');
    }
};

window.updateClassSpecificMaxMarks = async (examType, maxMarks) => {
    const classSelect = document.getElementById('config-class-select');
    const selectedClass = classSelect.value;
    
    if (!selectedClass) return;
    
    const configDocId = `${selectedClass}_${examType}`;
    
    try {
        await db.collection(MAX_MARKS_COLLECTION_PATH).doc(configDocId).set({
            classId: selectedClass,
            examType: examType,
            maxMarks: parseInt(maxMarks),
            updatedAt: new Date().toISOString()
        }, { merge: true });
        
        console.log(`Updated max marks for ${selectedClass} - ${examType}: ${maxMarks}`);
    } catch (error) {
        console.error('Error updating max marks:', error);
        showNotificationModal('Error', `Failed to update max marks: ${error.message}`);
    }
};

// Teacher Subject Allotment Modal
window.showTeacherUpdateModal = (uid) => {
    const teacher = userList[uid];
    if (!teacher) {
        showNotificationModal('Error', 'Teacher not found.');
        return;
    }
    
    const teacherAllotments = allotments.filter(a => a.teacherId === uid);
    
    const modalHtml = `
        <div id="teacher-allotment-modal" class="fixed inset-0 bg-gray-600 bg-opacity-75 z-50 flex items-center justify-center">
            <div class="bg-white p-6 rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                <div class="flex justify-between items-center mb-6">
                    <h3 class="text-2xl font-bold text-primary">Subject Allotment</h3>
                    <button onclick="closeTeacherAllotmentModal()" class="text-gray-400 hover:text-gray-600">
                        <i data-lucide="x" class="w-6 h-6"></i>
                    </button>
                </div>
                
                <div class="mb-4">
                    <h4 class="text-lg font-semibold text-gray-800">Teacher: ${teacher.name}</h4>
                    <p class="text-gray-600">Username: ${teacher.username}</p>
                </div>
                
                <!-- Current Allotments -->
                <div class="mb-6">
                    <h5 class="font-semibold text-gray-800 mb-3">Current Allotments</h5>
                    <div id="current-allotments" class="space-y-2 max-h-32 overflow-y-auto">
                        ${teacherAllotments.length > 0 ? 
                            teacherAllotments.map(a => `
                                <div class="flex justify-between items-center bg-gray-50 p-2 rounded">
                                    <span class="text-sm">${a.class} - ${a.subject}</span>
                                    <button onclick="removeAllotment('${a.id}')" class="text-red-500 hover:text-red-700">
                                        <i data-lucide="trash-2" class="w-4 h-4"></i>
                                    </button>
                                </div>
                            `).join('') : 
                            '<p class="text-gray-500 text-sm">No allotments yet</p>'
                        }
                    </div>
                </div>
                
                <!-- Add New Allotment -->
                <div class="border-t pt-4">
                    <h5 class="font-semibold text-gray-800 mb-3">Add New Allotment</h5>
                    <form id="allotment-form" onsubmit="event.preventDefault(); handleAddAllotment('${uid}', this);">
                        <div class="grid grid-cols-2 gap-4 mb-4">
                            <div>
                                <label class="block text-sm font-medium text-gray-700 mb-2">Class</label>
                                <select id="allotment-class" required class="w-full p-2 border border-gray-300 rounded-lg" onchange="updateAllotmentSubjects()">
                                    <option value="" disabled selected>Select Class</option>
                                    ${ALL_CLASSES.map(c => `<option value="${c}">${c}</option>`).join('')}
                                </select>
                            </div>
                            <div>
                                <label class="block text-sm font-medium text-gray-700 mb-2">Subject</label>
                                <select id="allotment-subject" required class="w-full p-2 border border-gray-300 rounded-lg">
                                    <option value="" disabled selected>Select Subject</option>
                                </select>
                            </div>
                        </div>
                        <div class="flex justify-end space-x-3">
                            <button type="button" onclick="closeTeacherAllotmentModal()" class="bg-gray-200 text-gray-700 font-semibold py-2 px-4 rounded-lg">Cancel</button>
                            <button type="submit" class="bg-primary text-white font-semibold py-2 px-4 rounded-lg hover:bg-indigo-600">Add Allotment</button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    `;
    
    document.getElementById('modal-container').insertAdjacentHTML('beforeend', modalHtml);
    
    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }
};

window.closeTeacherAllotmentModal = () => {
    const modal = document.getElementById('teacher-allotment-modal');
    if (modal) modal.remove();
};

window.updateAllotmentSubjects = () => {
    const classSelect = document.getElementById('allotment-class');
    const subjectSelect = document.getElementById('allotment-subject');
    
    if (!classSelect || !subjectSelect) return;
    
    const selectedClass = classSelect.value;
    subjectSelect.innerHTML = '<option value="" disabled selected>Select Subject</option>';
    
    if (selectedClass && SUBJECTS[selectedClass]) {
        SUBJECTS[selectedClass].forEach(subject => {
            const option = document.createElement('option');
            option.value = subject;
            option.textContent = subject;
            subjectSelect.appendChild(option);
        });
    }
};

window.handleAddAllotment = async (teacherId, form) => {
    const classId = form.elements['allotment-class'].value;
    const subject = form.elements['allotment-subject'].value;
    
    if (!classId || !subject) {
        showNotificationModal('Error', 'Please select both class and subject.');
        return;
    }
    
    // Check if allotment already exists
    const existingAllotment = allotments.find(a => 
        a.teacherId === teacherId && a.class === classId && a.subject === subject
    );
    
    if (existingAllotment) {
        showNotificationModal('Error', 'This allotment already exists.');
        return;
    }
    
    const allotmentData = {
        teacherId: teacherId,
        teacherName: userList[teacherId].name,
        class: classId,
        subject: subject,
        createdAt: new Date().toISOString()
    };
    
    try {
        await db.collection(ALLOTMENTS_COLLECTION_PATH).add(allotmentData);
        showNotificationModal('Success', 'Subject allotment added successfully!');
        closeTeacherAllotmentModal();
    } catch (error) {
        console.error('Error adding allotment:', error);
        showNotificationModal('Error', `Failed to add allotment: ${error.message}`);
    }
};

window.removeAllotment = async (allotmentId) => {
    if (!confirm('Are you sure you want to remove this allotment?')) return;
    
    try {
        await db.collection(ALLOTMENTS_COLLECTION_PATH).doc(allotmentId).delete();
        showNotificationModal('Success', 'Allotment removed successfully!');
        
        // Refresh the modal content
        const modal = document.getElementById('teacher-allotment-modal');
        if (modal) {
            modal.remove();
            // Re-open the modal with updated data
            setTimeout(() => {
                const teacherId = allotments.find(a => a.id === allotmentId)?.teacherId;
                if (teacherId) showTeacherUpdateModal(teacherId);
            }, 100);
        }
    } catch (error) {
        console.error('Error removing allotment:', error);
        showNotificationModal('Error', `Failed to remove allotment: ${error.message}`);
    }
};

// User Edit Modal
window.showUserEditModal = (uid) => {
    const user = userList[uid];
    if (!user) {
        showNotificationModal('Error', 'User not found.');
        return;
    }
    
    const modalHtml = `
        <div id="user-edit-modal" class="fixed inset-0 bg-gray-600 bg-opacity-75 z-50 flex items-center justify-center">
            <div class="bg-white p-6 rounded-xl shadow-2xl w-full max-w-md">
                <div class="flex justify-between items-center mb-6">
                    <h3 class="text-2xl font-bold text-primary">Edit User</h3>
                    <button onclick="closeUserEditModal()" class="text-gray-400 hover:text-gray-600">
                        <i data-lucide="x" class="w-6 h-6"></i>
                    </button>
                </div>
                
                <form id="edit-user-form" onsubmit="event.preventDefault(); handleEditUser('${uid}', this);">
                    <div class="mb-4">
                        <label class="block text-sm font-medium text-gray-700 mb-2">Full Name</label>
                        <input type="text" name="name" value="${user.name}" required class="w-full p-3 border border-gray-300 rounded-lg">
                    </div>
                    
                    <div class="mb-4">
                        <label class="block text-sm font-medium text-gray-700 mb-2">Username</label>
                        <input type="text" name="username" value="${user.username}" required class="w-full p-3 border border-gray-300 rounded-lg">
                    </div>
                    
                    <div class="mb-4">
                        <label class="block text-sm font-medium text-gray-700 mb-2">Role</label>
                        <select name="role" required class="w-full p-3 border border-gray-300 rounded-lg" onchange="toggleEditClassField(this.value)">
                            <option value="teacher" ${user.role === 'teacher' ? 'selected' : ''}>Teacher</option>
                            <option value="student" ${user.role === 'student' ? 'selected' : ''}>Student</option>
                        </select>
                    </div>
                    
                    <div id="edit-class-field" class="mb-4 ${user.role !== 'student' ? 'hidden' : ''}">
                        <label class="block text-sm font-medium text-gray-700 mb-2">Class</label>
                        <select name="class" class="w-full p-3 border border-gray-300 rounded-lg">
                            <option value="">Select Class</option>
                            ${ALL_CLASSES.map(c => `<option value="${c}" ${user.class === c ? 'selected' : ''}>${c}</option>`).join('')}
                        </select>
                    </div>
                    
                    <div class="mb-6">
                        <label class="block text-sm font-medium text-gray-700 mb-2">Password</label>
                        <input type="text" name="password" value="${user.loginPassword}" required class="w-full p-3 border border-gray-300 rounded-lg">
                    </div>
                    
                    <div class="flex justify-end space-x-3">
                        <button type="button" onclick="closeUserEditModal()" class="bg-gray-200 text-gray-700 font-semibold py-2 px-4 rounded-lg">Cancel</button>
                        <button type="submit" class="bg-primary text-white font-semibold py-2 px-4 rounded-lg hover:bg-indigo-600">Update User</button>
                    </div>
                </form>
            </div>
        </div>
    `;
    
    document.getElementById('modal-container').insertAdjacentHTML('beforeend', modalHtml);
    
    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }
};

window.closeUserEditModal = () => {
    const modal = document.getElementById('user-edit-modal');
    if (modal) modal.remove();
};

window.toggleEditClassField = (role) => {
    const classField = document.getElementById('edit-class-field');
    if (classField) {
        if (role === 'student') {
            classField.classList.remove('hidden');
        } else {
            classField.classList.add('hidden');
        }
    }
};

window.handleEditUser = async (uid, form) => {
    const name = form.elements['name'].value.trim();
    const username = form.elements['username'].value.trim();
    const role = form.elements['role'].value;
    const password = form.elements['password'].value;
    const classValue = form.elements['class'] ? form.elements['class'].value : null;
    
    if (!name || !username || !role || !password) {
        showNotificationModal('Error', 'Please fill in all required fields.');
        return;
    }
    
    if (role === 'student' && !classValue) {
        showNotificationModal('Error', 'Please select a class for the student.');
        return;
    }
    
    // Check if username already exists (excluding current user)
    const existingUser = Object.values(userList).find(u => u.username === username && u.uid !== uid);
    if (existingUser) {
        showNotificationModal('Error', 'Username already exists. Please choose a different username.');
        return;
    }
    
    const userData = {
        name: name,
        username: username,
        role: role,
        loginPassword: password,
        email: `${username}@school.edu`,
        updatedAt: new Date().toISOString()
    };
    
    if (role === 'student') {
        userData.class = classValue;
    } else {
        // Remove class field if changing from student to teacher
        userData.class = null;
    }
    
    try {
        await db.collection(USERS_LIST_COLLECTION_PATH).doc(uid).update(userData);
        showNotificationModal('Success', 'User updated successfully!');
        closeUserEditModal();
    } catch (error) {
        console.error('Error updating user:', error);
        showNotificationModal('Error', `Failed to update user: ${error.message}`);
    }
};

window.handleDeleteUser = (uid, name, role) => {
    if (confirm(`Are you sure you want to delete ${role} "${name}"? This action cannot be undone.`)) {
        deleteUser(uid, name, role);
    }
};

const deleteUser = async (uid, name, role) => {
    try {
        await db.collection(USERS_LIST_COLLECTION_PATH).doc(uid).delete();
        showNotificationModal('Success', `${role.charAt(0).toUpperCase() + role.slice(1)} "${name}" has been deleted successfully.`);
    } catch (error) {
        console.error('Error deleting user:', error);
        showNotificationModal('Error', `Failed to delete user: ${error.message}`);
    }
};

// Excel Import/Export Functions
window.handleDownloadStudentSample = () => {
    // Create sample data
    const sampleData = [
        {
            name: 'John Doe',
            username: 'STU001',
            class: '5th',
            loginPassword: '123456'
        },
        {
            name: 'Jane Smith',
            username: 'STU002',
            class: '6th',
            loginPassword: '123456'
        },
        {
            name: 'Mike Johnson',
            username: 'STU003',
            class: '7th',
            loginPassword: '123456'
        }
    ];
    
    // Check if XLSX is available
    if (typeof XLSX === 'undefined') {
        showNotificationModal('Error', 'Excel library not loaded. Please refresh the page and try again.');
        return;
    }
    
    try {
        // Create workbook and worksheet
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.json_to_sheet(sampleData);
        
        // Add worksheet to workbook
        XLSX.utils.book_append_sheet(wb, ws, 'Students');
        
        // Generate and download file
        XLSX.writeFile(wb, 'student_import_template.xlsx');
        
        showNotificationModal('Success', 'Sample Excel template downloaded successfully!');
    } catch (error) {
        console.error('Error generating Excel file:', error);
        showNotificationModal('Error', 'Failed to generate Excel template. Please try again.');
    }
};

window.handleImportStudentsFromExcel = async () => {
    const fileInput = document.getElementById('student-excel-file');
    const file = fileInput.files[0];
    
    if (!file) {
        showNotificationModal('Error', 'Please select an Excel file first.');
        return;
    }
    
    // Check if XLSX is available
    if (typeof XLSX === 'undefined') {
        showNotificationModal('Error', 'Excel library not loaded. Please refresh the page and try again.');
        return;
    }
    
    try {
        const data = await readExcelFile(file);
        
        if (!data || data.length === 0) {
            showNotificationModal('Error', 'No data found in the Excel file.');
            return;
        }
        
        // Validate required columns
        const requiredColumns = ['name', 'username', 'class'];
        const firstRow = data[0];
        const missingColumns = requiredColumns.filter(col => !(col in firstRow));
        
        if (missingColumns.length > 0) {
            showNotificationModal('Error', `Missing required columns: ${missingColumns.join(', ')}`);
            return;
        }
        
        // Process and validate data
        const validStudents = [];
        const errors = [];
        
        for (let i = 0; i < data.length; i++) {
            const row = data[i];
            const rowNum = i + 2; // Excel row number (accounting for header)
            
            // Validate required fields
            if (!row.name || !row.username || !row.class) {
                errors.push(`Row ${rowNum}: Missing required fields`);
                continue;
            }
            
            // Validate class
            if (!ALL_CLASSES.includes(row.class)) {
                errors.push(`Row ${rowNum}: Invalid class "${row.class}". Must be one of: ${ALL_CLASSES.join(', ')}`);
                continue;
            }
            
            // Check for duplicate username in existing users
            const existingUser = Object.values(userList).find(u => u.username === row.username);
            if (existingUser) {
                errors.push(`Row ${rowNum}: Username "${row.username}" already exists`);
                continue;
            }
            
            // Check for duplicate username in current batch
            const duplicateInBatch = validStudents.find(s => s.username === row.username);
            if (duplicateInBatch) {
                errors.push(`Row ${rowNum}: Duplicate username "${row.username}" in file`);
                continue;
            }
            
            // Create student object
            const uid = generateUID('student');
            const studentData = {
                uid: uid,
                name: row.name.trim(),
                role: 'student',
                username: row.username.trim(),
                loginPassword: row.loginPassword || '123456',
                class: row.class,
                email: `${row.username.trim()}@school.edu`
            };
            
            validStudents.push(studentData);
        }
        
        if (validStudents.length === 0) {
            showNotificationModal('Error', `No valid students to import. Errors:\n${errors.join('\n')}`);
            return;
        }
        
        // Show confirmation dialog
        const confirmMessage = `Found ${validStudents.length} valid students to import.${errors.length > 0 ? `\n\n${errors.length} rows had errors and will be skipped.` : ''}\n\nProceed with import?`;
        
        if (!confirm(confirmMessage)) {
            return;
        }
        
        // Import students
        let successCount = 0;
        let failCount = 0;
        
        for (const studentData of validStudents) {
            try {
                await db.collection(USERS_LIST_COLLECTION_PATH).doc(studentData.uid).set(studentData);
                successCount++;
            } catch (error) {
                console.error('Error importing student:', error);
                failCount++;
            }
        }
        
        // Show results
        let resultMessage = `Import completed!\n\nSuccessfully imported: ${successCount} students`;
        if (failCount > 0) {
            resultMessage += `\nFailed to import: ${failCount} students`;
        }
        if (errors.length > 0) {
            resultMessage += `\nSkipped due to errors: ${errors.length} rows`;
        }
        
        showNotificationModal('Import Results', resultMessage);
        
        // Clear file input
        fileInput.value = '';
        
    } catch (error) {
        console.error('Error importing students:', error);
        showNotificationModal('Error', `Failed to import students: ${error.message}`);
    }
};

// Helper function to read Excel file
const readExcelFile = (file) => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        
        reader.onload = (e) => {
            try {
                const data = new Uint8Array(e.target.result);
                const workbook = XLSX.read(data, { type: 'array' });
                
                // Get first worksheet
                const firstSheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[firstSheetName];
                
                // Convert to JSON
                const jsonData = XLSX.utils.sheet_to_json(worksheet);
                resolve(jsonData);
            } catch (error) {
                reject(error);
            }
        };
        
        reader.onerror = () => reject(new Error('Failed to read file'));
        reader.readAsArrayBuffer(file);
    });
};

// --- TEACHER PANEL FUNCTIONS ---
const renderTeacherPanel = () => {
    const panel = document.getElementById('content-panel');
    
    if (!currentUserData) {
        console.error('No current user data available for teacher panel');
        return;
    }
    
    const teacherAllotments = allotments.filter(a => a.teacherId === currentUserData.uid);
    const unreadNotificationCount = getUnreadNotificationCount('teachers');
    
    panel.innerHTML = `
        <p class="text-gray-600 mb-4">Welcome, ${currentUserData.name}</p>
        
        <!-- Teacher Panel Tabs Only -->
        <div class="teacher-tabs-container">
            <div class="grid grid-cols-1 md:grid-cols-3 gap-3 max-w-4xl mx-auto">
                <button data-tab-name="homework" onclick="openTeacherSection('homework')" class="teacher-tab-card bg-blue-500 hover:bg-blue-600 text-white p-4 rounded-lg shadow-lg transition-all duration-300 transform hover:scale-105">
                    <div class="flex flex-col items-center">
                        <i data-lucide="clipboard-list" class="w-8 h-8 mb-2"></i>
                        <h3 class="text-lg font-semibold mb-1">Homework</h3>
                        <p class="text-blue-100 text-sm">Assign & manage homework</p>
                    </div>
                </button>
                
                <button data-tab-name="marks" onclick="openTeacherSection('marks')" class="teacher-tab-card bg-green-500 hover:bg-green-600 text-white p-4 rounded-lg shadow-lg transition-all duration-300 transform hover:scale-105">
                    <div class="flex flex-col items-center">
                        <i data-lucide="calculator" class="w-8 h-8 mb-2"></i>
                        <h3 class="text-lg font-semibold mb-1">Marks Entry</h3>
                        <p class="text-green-100 text-sm">Enter student marks</p>
                    </div>
                </button>
                
                <button data-tab-name="teacher-notifications" onclick="openTeacherSection('teacher-notifications')" class="teacher-tab-card bg-purple-500 hover:bg-purple-600 text-white p-4 rounded-lg shadow-lg transition-all duration-300 transform hover:scale-105 relative">
                    ${unreadNotificationCount > 0 ? `<div class="absolute -top-2 -right-2 bg-red-500 text-white text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center">${unreadNotificationCount}</div>` : ''}
                    <div class="flex flex-col items-center">
                        <i data-lucide="bell" class="w-8 h-8 mb-2"></i>
                        <h3 class="text-lg font-semibold mb-1">Notifications</h3>
                        <p class="text-purple-100 text-sm">${unreadNotificationCount > 0 ? `${unreadNotificationCount} unread` : 'View notifications'}</p>
                    </div>
                </button>
            </div>
        </div>

        <!-- Homework Management Section -->
        <div id="homework-section" class="bg-white p-4 rounded-xl shadow-lg border border-gray-100 hidden">
            <h3 class="text-xl font-semibold text-gray-800 mb-4 border-b pb-2 flex items-center">
                <i data-lucide="clipboard-list" class="w-5 h-5 mr-2"></i>
                Homework Management
            </h3>
            
            <!-- Add Homework Form -->
            <div class="mb-6 bg-gradient-to-r from-blue-50 to-indigo-50 p-4 rounded-lg border border-blue-200">
                <div class="flex justify-between items-center mb-3">
                    <h4 class="text-lg font-semibold text-gray-800">Assign New Homework</h4>
                    <button type="button" onclick="debugHomeworkForm()" class="bg-gray-100 text-gray-700 px-2 py-1 rounded text-xs hover:bg-gray-200">
                        <i data-lucide="refresh-cw" class="w-3 h-3 inline mr-1"></i>
                        Debug
                    </button>
                </div>
                <form id="homework-form" onsubmit="event.preventDefault(); handleAddHomework(this);">
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                        <div>
                            <label for="homework-class" class="block text-sm font-medium text-gray-700 mb-2">Class</label>
                            <select id="homework-class" required class="w-full p-2 border border-gray-300 rounded-lg focus:border-primary focus:ring focus:ring-primary focus:ring-opacity-50" onchange="updateSubjectOptions()">
                                <option value="" disabled selected>Select Class</option>
                                ${getTeacherClasses().map(c => `<option value="${c}">${c}</option>`).join('')}
                            </select>
                        </div>
                        <div>
                            <label for="homework-subject" class="block text-sm font-medium text-gray-700 mb-2">Subject</label>
                            <select id="homework-subject" required class="w-full p-2 border border-gray-300 rounded-lg focus:border-primary focus:ring focus:ring-primary focus:ring-opacity-50">
                                <option value="" disabled selected>Select Subject</option>
                            </select>
                        </div>
                    </div>
                    <div class="mb-3">
                        <label for="homework-title" class="block text-sm font-medium text-gray-700 mb-2">Homework Title</label>
                        <input type="text" id="homework-title" required class="w-full p-2 border border-gray-300 rounded-lg focus:border-primary focus:ring focus:ring-primary focus:ring-opacity-50" placeholder="e.g., Chapter 5 Exercise Questions">
                    </div>
                    <div class="mb-3">
                        <label for="homework-description" class="block text-sm font-medium text-gray-700 mb-2">Description</label>
                        <textarea id="homework-description" required rows="3" class="w-full p-2 border border-gray-300 rounded-lg focus:border-primary focus:ring focus:ring-primary focus:ring-opacity-50" placeholder="Detailed homework instructions..."></textarea>
                    </div>
                    <div class="mb-3">
                        <label for="homework-due-date" class="block text-sm font-medium text-gray-700 mb-2">Due Date</label>
                        <input type="date" id="homework-due-date" required class="w-full p-2 border border-gray-300 rounded-lg focus:border-primary focus:ring focus:ring-primary focus:ring-opacity-50">
                    </div>
                    <div class="mb-4">
                        <label for="homework-attachment" class="block text-sm font-medium text-gray-700 mb-2">Attachment (Optional)</label>
                        <input type="file" id="homework-attachment" accept=".pdf,.doc,.docx,.jpg,.jpeg,.png" class="w-full p-2 border border-gray-300 rounded-lg focus:border-primary focus:ring focus:ring-primary focus:ring-opacity-50">
                        <p class="text-xs text-gray-500 mt-1">Supported formats: PDF, DOC, DOCX, JPG, PNG (Max 5MB)</p>
                    </div>
                    <button type="submit" class="w-full bg-secondary text-white font-semibold py-2 rounded-lg hover:bg-emerald-600 transition duration-150 shadow-md flex items-center justify-center">
                        <i data-lucide="plus" class="w-4 h-4 mr-2"></i>
                        Assign Homework
                    </button>
                </form>
            </div>
            
            <!-- Assigned Homework List -->
            <div>
                <div class="homework-header-mobile flex justify-between items-center mb-4">
                    <h4 class="homework-title-mobile text-lg font-semibold text-gray-800 mb-4 md:mb-0">Previously Assigned Homework</h4>
                    <div class="date-filter-container">
                        <div class="date-filter-group">
                            <label for="teacher-homework-date-from" class="text-sm font-medium text-gray-700">From:</label>
                            <input type="date" id="teacher-homework-date-from" class="date-filter-input px-3 py-2 border border-gray-300 rounded-lg text-sm focus:border-primary focus:ring focus:ring-primary focus:ring-opacity-50" onchange="filterTeacherHomework()">
                        </div>
                        <div class="date-filter-group">
                            <label for="teacher-homework-date-to" class="text-sm font-medium text-gray-700">To:</label>
                            <input type="date" id="teacher-homework-date-to" class="date-filter-input px-3 py-2 border border-gray-300 rounded-lg text-sm focus:border-primary focus:ring focus:ring-primary focus:ring-opacity-50" onchange="filterTeacherHomework()">
                        </div>
                        <div class="date-filter-presets">
                            <button type="button" onclick="setTeacherHomeworkDateRange('today')" class="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs hover:bg-blue-200 transition duration-150">Today</button>
                            <button type="button" onclick="setTeacherHomeworkDateRange('week')" class="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs hover:bg-blue-200 transition duration-150">This Week</button>
                            <button type="button" onclick="setTeacherHomeworkDateRange('month')" class="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs hover:bg-blue-200 transition duration-150">This Month</button>
                        </div>
                        <div class="date-filter-actions">
                            <button type="button" onclick="clearTeacherHomeworkFilter()" class="px-3 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm hover:bg-gray-200 transition duration-150">
                                <i data-lucide="x" class="w-4 h-4 inline mr-1"></i>
                                Clear
                            </button>
                            <button type="button" onclick="bulkDeleteHomework()" class="px-3 py-2 bg-red-100 text-red-700 rounded-lg text-sm hover:bg-red-200 transition duration-150">
                                <i data-lucide="trash-2" class="w-4 h-4 inline mr-1"></i>
                                Bulk Delete
                            </button>
                        </div>
                    </div>
                </div>
                <div id="teacher-homework-list" class="space-y-4">
                    ${renderTeacherHomeworkList()}
                </div>
            </div>
        </div>

        <!-- Marks Entry Section -->
        <div id="marks-section" class="bg-white p-6 rounded-xl shadow-lg border border-gray-100 hidden">
            <h3 class="text-xl font-semibold text-gray-800 mb-6 border-b pb-3 flex items-center">
                <i data-lucide="calculator" class="w-5 h-5 mr-2"></i>
                Marks Entry
            </h3>
            
            <!-- Marks Entry Form -->
            <div class="mb-8 bg-gradient-to-r from-green-50 to-emerald-50 p-6 rounded-lg border border-green-200">
                <div class="flex justify-between items-center mb-4">
                    <h4 class="text-lg font-semibold text-gray-800">Enter Student Marks</h4>
                    <div class="flex items-center space-x-2">
                        <button type="button" onclick="debugMarksForm()" class="bg-gray-100 text-gray-700 px-2 py-1 rounded text-xs hover:bg-gray-200">
                            <i data-lucide="refresh-cw" class="w-3 h-3 inline mr-1"></i>
                            Debug
                        </button>
                        <button type="button" onclick="testMarksForm()" class="bg-green-100 text-green-700 px-2 py-1 rounded text-xs hover:bg-green-200">
                            <i data-lucide="play" class="w-3 h-3 inline mr-1"></i>
                            Test
                        </button>
                        <div class="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-xs font-semibold">
                            <i data-lucide="info" class="w-3 h-3 inline mr-1"></i>
                            3rd Grade & Above Only
                        </div>
                    </div>
                </div>
                <form id="marks-form" onsubmit="event.preventDefault(); handleAddMarks(this);">
                    <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                        <div>
                            <label for="marks-class" class="block text-sm font-medium text-gray-700 mb-2">Class</label>
                            <select id="marks-class" required class="w-full p-3 border border-gray-300 rounded-lg focus:border-primary focus:ring focus:ring-primary focus:ring-opacity-50" onchange="updateMarksFormState()">
                                <option value="" disabled selected>Select Class</option>
                                ${getTeacherClassesForMarks().map(c => `<option value="${c}">${c}</option>`).join('')}
                            </select>
                        </div>
                        <div>
                            <label for="marks-subject" class="block text-sm font-medium text-gray-700 mb-2">Subject</label>
                            <select id="marks-subject" required class="w-full p-3 border border-gray-300 rounded-lg focus:border-primary focus:ring focus:ring-primary focus:ring-opacity-50" onchange="updateMarksFormState()">
                                <option value="" disabled selected>Select Subject</option>
                            </select>
                        </div>
                        <div>
                            <label for="marks-exam-type" class="block text-sm font-medium text-gray-700 mb-2">Exam Type</label>
                            <select id="marks-exam-type" required class="w-full p-3 border border-gray-300 rounded-lg focus:border-primary focus:ring focus:ring-primary focus:ring-opacity-50" onchange="updateMarksFormState()">
                                <option value="" disabled selected>Select Exam</option>
                                ${EXAM_TYPES.map(e => `<option value="${e}">${e}</option>`).join('')}
                            </select>
                        </div>
                    </div>
                    
                    <!-- Student Marks Entry -->
                    <div id="student-marks-container" class="hidden">
                        <div class="mb-4">
                            <div class="flex justify-between items-center mb-2">
                                <label class="block text-sm font-medium text-gray-700">Student Marks</label>
                                <span id="max-marks-display" class="text-sm text-gray-500"></span>
                            </div>
                            <div id="student-marks-list" class="space-y-3 max-h-96 overflow-y-auto">
                                <!-- Student marks inputs will be generated here -->
                            </div>
                        </div>
                        <button type="submit" class="w-full bg-primary text-white font-semibold py-3 rounded-lg hover:bg-indigo-600 transition duration-150 shadow-md flex items-center justify-center">
                            <i data-lucide="save" class="w-4 h-4 mr-2"></i>
                            Save Marks
                        </button>
                    </div>
                </form>
            </div>
        </div>

        <!-- Notifications Section -->
        <div id="teacher-notifications-section" class="bg-white p-6 rounded-xl shadow-lg border border-gray-100 hidden">
            <h3 class="text-xl font-semibold text-gray-800 mb-6 border-b pb-3 flex items-center">
                <i data-lucide="bell" class="w-5 h-5 mr-2"></i>
                My Notifications
            </h3>
            
            <div id="teacher-notifications-list" class="space-y-4">
                ${renderUserNotificationsList('teachers')}
            </div>
        </div>
    `;
    
    // Set default due date to tomorrow
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];
    const dueDateInput = document.getElementById('homework-due-date');
    if (dueDateInput) {
        dueDateInput.value = tomorrowStr;
    }
    
    // Debug current state
    console.log('=== TEACHER PANEL DEBUG ===');
    console.log('Current user:', currentUserData);
    console.log('Total allotments:', allotments.length);
    console.log('Total students:', students.length);
    console.log('Teacher classes:', getTeacherClasses());
    console.log('Teacher classes for marks:', getTeacherClassesForMarks());
    console.log('=== END DEBUG ===');
    
    // Initialize form states
    setTimeout(() => {
        if (activeTeacherTab === 'marks') {
            updateMarksFormState();
        }
        // Also trigger subject options update for homework form
        updateSubjectOptions();
    }, 100);
    
    console.log('Teacher panel rendered successfully');
    
    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }
};

// New function to open teacher sections
window.openTeacherSection = (section) => {
    console.log('Opening teacher section:', section);
    
    // Hide the tabs container
    const tabsContainer = document.querySelector('.teacher-tabs-container');
    if (tabsContainer) {
        tabsContainer.classList.add('hidden');
        console.log('Teacher tabs container hidden');
    } else {
        console.error('Teacher tabs container not found');
    }
    
    // Show back button
    const backButton = `
        <div class="mb-6">
            <button onclick="showTeacherTabs()" class="btn-secondary flex items-center mb-4">
                <i data-lucide="arrow-left" class="w-4 h-4 mr-2"></i>
                Back to Teacher Panel
            </button>
        </div>
    `;
    
    // Hide all sections
    document.getElementById('homework-section')?.classList.add('hidden');
    document.getElementById('teacher-notifications-section')?.classList.add('hidden');
    document.getElementById('marks-section')?.classList.add('hidden');
    
    // Show the selected section
    const targetSection = document.getElementById(`${section}-section`);
    console.log('Looking for teacher section:', `${section}-section`);
    if (targetSection) {
        targetSection.classList.remove('hidden');
        console.log('Teacher section shown:', section);
        
        // Mark section as viewed to reset badge count
        if (section === 'teacher-notifications') {
            markNotificationsAsViewed();
        }
        
        // Add back button to the section
        if (!targetSection.querySelector('.back-button-container')) {
            targetSection.insertAdjacentHTML('afterbegin', `<div class="back-button-container">${backButton}</div>`);
        }
    } else {
        console.error('Teacher section not found:', `${section}-section`);
    }
    
    // If switching to marks tab, trigger form state update
    if (section === 'marks') {
        setTimeout(() => {
            updateMarksFormState();
        }, 100);
    }
    
    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }
};

// Function to show teacher tabs again
window.showTeacherTabs = () => {
    // Hide all sections
    document.getElementById('homework-section')?.classList.add('hidden');
    document.getElementById('teacher-notifications-section')?.classList.add('hidden');
    document.getElementById('marks-section')?.classList.add('hidden');
    
    // Refresh the entire teacher panel to update badge counts
    if (currentUserData && currentUserData.role === 'teacher') {
        renderTeacherPanel();
    }
};

// Legacy teacher tab switching function (kept for compatibility)
window.switchTeacherTab = (tab) => {
    openTeacherSection(tab);
};

// Get classes that the teacher is assigned to
const getTeacherClasses = () => {
    if (!currentUserData || currentUserData.role !== 'teacher') {
        console.log('getTeacherClasses: No current user or not a teacher');
        return [];
    }
    console.log('getTeacherClasses: Current user:', currentUserData.uid, currentUserData.name);
    console.log('getTeacherClasses: Total allotments:', allotments.length);
    
    const teacherAllotments = allotments.filter(a => a.teacherId === currentUserData.uid);
    console.log('getTeacherClasses: Teacher allotments:', teacherAllotments);
    
    const classes = [...new Set(teacherAllotments.map(a => a.class))];
    console.log('getTeacherClasses: Unique classes:', classes);
    
    return classes.sort();
};

// Get classes for marks entry (3rd grade and onward only)
const getTeacherClassesForMarks = () => {
    const allClasses = getTeacherClasses();
    // Filter to only include 3rd grade and above
    const marksEligibleClasses = allClasses.filter(className => {
        // Extract number from class name (e.g., "3rd" -> 3, "10th" -> 10)
        const classNumber = parseInt(className.match(/\d+/)?.[0]);
        return classNumber && classNumber >= 3;
    });
    console.log('Marks eligible classes:', marksEligibleClasses);
    return marksEligibleClasses;
};

// Update subject options based on selected class
window.updateSubjectOptions = () => {
    const classSelect = document.getElementById('homework-class');
    const subjectSelect = document.getElementById('homework-subject');
    
    console.log('updateSubjectOptions called');
    console.log('Elements found:', { classSelect: !!classSelect, subjectSelect: !!subjectSelect });
    
    if (!classSelect || !subjectSelect) {
        console.log('Missing elements for subject update');
        return;
    }
    
    const selectedClass = classSelect.value;
    console.log('Selected class for homework:', selectedClass);
    console.log('Current user:', currentUserData?.uid);
    console.log('Total allotments:', allotments.length);
    
    subjectSelect.innerHTML = '<option value="" disabled selected>Select Subject</option>';
    
    if (selectedClass && currentUserData) {
        const teacherAllotments = allotments.filter(a => 
            a.teacherId === currentUserData.uid && a.class === selectedClass
        );
        
        console.log('Teacher allotments for homework class:', teacherAllotments);
        
        if (teacherAllotments.length === 0) {
            console.log('No allotments found for teacher', currentUserData.uid, 'in class', selectedClass);
            subjectSelect.innerHTML = '<option value="" disabled>No subjects assigned for this class</option>';
            return;
        }
        
        teacherAllotments.forEach(allotment => {
            const option = document.createElement('option');
            option.value = allotment.subject;
            option.textContent = allotment.subject;
            subjectSelect.appendChild(option);
            console.log('Added subject option:', allotment.subject);
        });
    }
};

// Render teacher's homework list
const renderTeacherHomeworkList = () => {
    const teacherHomeworks = homeworks.filter(h => h.teacherId === currentUserData.uid);
    
    if (teacherHomeworks.length === 0) {
        return '<p class="text-gray-500 text-center py-8">No homework assigned yet.</p>';
    }
    
    return teacherHomeworks.sort((a, b) => new Date(b.assignedDate) - new Date(a.assignedDate))
        .map(homework => `
            <div class="bg-gray-50 p-4 rounded-lg border border-gray-200">
                <div class="flex justify-between items-start mb-2">
                    <h5 class="font-semibold text-gray-800">${homework.title}</h5>
                    <div class="flex items-center space-x-2">
                        <span class="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full">${homework.class} - ${homework.subject}</span>
                        <button onclick="editHomework('${homework.id}')" class="text-blue-600 hover:text-blue-800" title="Edit">
                            <i data-lucide="edit" class="w-4 h-4"></i>
                        </button>
                        <button onclick="deleteHomework('${homework.id}', '${homework.title}')" class="text-red-600 hover:text-red-800" title="Delete">
                            <i data-lucide="trash-2" class="w-4 h-4"></i>
                        </button>
                    </div>
                </div>
                <p class="text-gray-600 text-sm mb-2">${homework.description}</p>
                ${homework.attachmentUrl ? `
                    <div class="mb-2">
                        <a href="${homework.attachmentUrl}" target="_blank" class="text-blue-600 hover:text-blue-800 text-sm flex items-center">
                            <i data-lucide="paperclip" class="w-4 h-4 mr-1"></i>
                            ${homework.attachmentName || 'View Attachment'}
                        </a>
                    </div>
                ` : ''}
                <div class="flex justify-between items-center text-xs text-gray-500">
                    <span>Assigned: ${new Date(homework.assignedDate).toLocaleDateString()}</span>
                    <span class="font-medium ${new Date(homework.dueDate) < new Date() ? 'text-red-600' : 'text-green-600'}">
                        Due: ${new Date(homework.dueDate).toLocaleDateString()}
                    </span>
                </div>
            </div>
        `).join('');
};

// Handle homework assignment
window.handleAddHomework = async (form) => {
    const classId = form.elements['homework-class'].value;
    const subject = form.elements['homework-subject'].value;
    const title = form.elements['homework-title'].value.trim();
    const description = form.elements['homework-description'].value.trim();
    const dueDate = form.elements['homework-due-date'].value;
    const attachmentFile = form.elements['homework-attachment'].files[0];

    if (!classId || !subject || !title || !description || !dueDate) {
        showNotificationModal('Error', 'Please fill in all fields.');
        return;
    }

    // Validate file size if attachment exists
    if (attachmentFile && attachmentFile.size > 5 * 1024 * 1024) { // 5MB limit
        showNotificationModal('Error', 'Attachment file size must be less than 5MB.');
        return;
    }

    const homeworkData = {
        teacherId: currentUserData.uid,
        teacherName: currentUserData.name,
        class: classId,
        subject: subject,
        title: title,
        description: description,
        dueDate: dueDate,
        assignedDate: new Date().toISOString().split('T')[0],
        createdAt: new Date().toISOString()
    };

    // Handle file attachment (simplified - in production, you'd upload to Firebase Storage)
    if (attachmentFile) {
        // For demo purposes, we'll create a data URL
        try {
            const fileDataUrl = await fileToDataUrl(attachmentFile);
            homeworkData.attachmentUrl = fileDataUrl;
            homeworkData.attachmentName = attachmentFile.name;
            homeworkData.attachmentType = attachmentFile.type;
        } catch (error) {
            console.error('Error processing attachment:', error);
            showNotificationModal('Warning', 'Homework will be saved without attachment due to processing error.');
        }
    }

    try {
        await db.collection(HOMEWORK_COLLECTION_PATH).add(homeworkData);
        showNotificationModal('Success', 'Homework assigned successfully!');
        
        // Refresh student panel badges if needed
        refreshStudentPanelBadges();
        
        // Reset form
        form.reset();
        document.getElementById('homework-subject').innerHTML = '<option value="" disabled selected>Select Subject</option>';
        
        // Set due date to tomorrow again
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        document.getElementById('homework-due-date').value = tomorrow.toISOString().split('T')[0];
        
    } catch (error) {
        console.error('Error adding homework:', error);
        showNotificationModal('Error', `Failed to assign homework: ${error.message}`);
    }
};

// Helper function to convert file to data URL
const fileToDataUrl = (file) => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
};

// Edit homework function
window.editHomework = (homeworkId) => {
    const homework = homeworks.find(h => h.id === homeworkId);
    if (!homework) {
        showNotificationModal('Error', 'Homework not found.');
        return;
    }
    
    const modalHtml = `
        <div id="edit-homework-modal" class="fixed inset-0 bg-gray-600 bg-opacity-75 z-50 flex items-center justify-center">
            <div class="bg-white p-6 rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                <div class="flex justify-between items-center mb-6">
                    <h3 class="text-2xl font-bold text-primary">Edit Homework</h3>
                    <button onclick="closeEditHomeworkModal()" class="text-gray-400 hover:text-gray-600">
                        <i data-lucide="x" class="w-6 h-6"></i>
                    </button>
                </div>
                
                <form id="edit-homework-form" onsubmit="event.preventDefault(); handleEditHomework('${homeworkId}', this);">
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-2">Class</label>
                            <select name="class" required class="w-full p-3 border border-gray-300 rounded-lg" onchange="updateEditSubjectOptions()">
                                ${getTeacherClasses().map(c => `<option value="${c}" ${homework.class === c ? 'selected' : ''}>${c}</option>`).join('')}
                            </select>
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-2">Subject</label>
                            <select name="subject" required class="w-full p-3 border border-gray-300 rounded-lg">
                                <option value="${homework.subject}" selected>${homework.subject}</option>
                            </select>
                        </div>
                    </div>
                    <div class="mb-4">
                        <label class="block text-sm font-medium text-gray-700 mb-2">Title</label>
                        <input type="text" name="title" value="${homework.title}" required class="w-full p-3 border border-gray-300 rounded-lg">
                    </div>
                    <div class="mb-4">
                        <label class="block text-sm font-medium text-gray-700 mb-2">Description</label>
                        <textarea name="description" required rows="3" class="w-full p-3 border border-gray-300 rounded-lg">${homework.description}</textarea>
                    </div>
                    <div class="mb-4">
                        <label class="block text-sm font-medium text-gray-700 mb-2">Due Date</label>
                        <input type="date" name="dueDate" value="${homework.dueDate}" required class="w-full p-3 border border-gray-300 rounded-lg">
                    </div>
                    ${homework.attachmentUrl ? `
                        <div class="mb-4">
                            <label class="block text-sm font-medium text-gray-700 mb-2">Current Attachment</label>
                            <div class="flex items-center space-x-2 p-2 bg-gray-50 rounded">
                                <i data-lucide="paperclip" class="w-4 h-4 text-gray-500"></i>
                                <span class="text-sm text-gray-700">${homework.attachmentName}</span>
                                <button type="button" onclick="removeAttachment('${homeworkId}')" class="text-red-600 hover:text-red-800">
                                    <i data-lucide="x" class="w-4 h-4"></i>
                                </button>
                            </div>
                        </div>
                    ` : ''}
                    <div class="mb-6">
                        <label class="block text-sm font-medium text-gray-700 mb-2">New Attachment (Optional)</label>
                        <input type="file" name="attachment" accept=".pdf,.doc,.docx,.jpg,.jpeg,.png" class="w-full p-3 border border-gray-300 rounded-lg">
                    </div>
                    
                    <div class="flex justify-end space-x-3">
                        <button type="button" onclick="closeEditHomeworkModal()" class="bg-gray-200 text-gray-700 font-semibold py-2 px-4 rounded-lg">Cancel</button>
                        <button type="submit" class="bg-primary text-white font-semibold py-2 px-4 rounded-lg hover:bg-indigo-600">Update Homework</button>
                    </div>
                </form>
            </div>
        </div>
    `;
    
    document.getElementById('modal-container').insertAdjacentHTML('beforeend', modalHtml);
    
    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }
};

window.closeEditHomeworkModal = () => {
    const modal = document.getElementById('edit-homework-modal');
    if (modal) modal.remove();
};

window.updateEditSubjectOptions = () => {
    const classSelect = document.querySelector('#edit-homework-form select[name="class"]');
    const subjectSelect = document.querySelector('#edit-homework-form select[name="subject"]');
    
    if (!classSelect || !subjectSelect) return;
    
    const selectedClass = classSelect.value;
    subjectSelect.innerHTML = '<option value="" disabled selected>Select Subject</option>';
    
    if (selectedClass) {
        const teacherAllotments = allotments.filter(a => 
            a.teacherId === currentUserData.uid && a.class === selectedClass
        );
        
        teacherAllotments.forEach(allotment => {
            const option = document.createElement('option');
            option.value = allotment.subject;
            option.textContent = allotment.subject;
            subjectSelect.appendChild(option);
        });
    }
};

window.handleEditHomework = async (homeworkId, form) => {
    const classId = form.elements['class'].value;
    const subject = form.elements['subject'].value;
    const title = form.elements['title'].value.trim();
    const description = form.elements['description'].value.trim();
    const dueDate = form.elements['dueDate'].value;
    const attachmentFile = form.elements['attachment'].files[0];

    if (!classId || !subject || !title || !description || !dueDate) {
        showNotificationModal('Error', 'Please fill in all fields.');
        return;
    }

    const updateData = {
        class: classId,
        subject: subject,
        title: title,
        description: description,
        dueDate: dueDate,
        updatedAt: new Date().toISOString()
    };

    // Handle new attachment
    if (attachmentFile) {
        if (attachmentFile.size > 5 * 1024 * 1024) {
            showNotificationModal('Error', 'Attachment file size must be less than 5MB.');
            return;
        }
        
        try {
            const fileDataUrl = await fileToDataUrl(attachmentFile);
            updateData.attachmentUrl = fileDataUrl;
            updateData.attachmentName = attachmentFile.name;
            updateData.attachmentType = attachmentFile.type;
        } catch (error) {
            console.error('Error processing attachment:', error);
            showNotificationModal('Warning', 'Homework will be updated without new attachment due to processing error.');
        }
    }

    try {
        await db.collection(HOMEWORK_COLLECTION_PATH).doc(homeworkId).update(updateData);
        showNotificationModal('Success', 'Homework updated successfully!');
        closeEditHomeworkModal();
    } catch (error) {
        console.error('Error updating homework:', error);
        showNotificationModal('Error', `Failed to update homework: ${error.message}`);
    }
};

// Delete homework function
window.deleteHomework = async (homeworkId, title) => {
    if (!confirm(`Are you sure you want to delete homework "${title}"? This action cannot be undone.`)) {
        return;
    }
    
    try {
        await db.collection(HOMEWORK_COLLECTION_PATH).doc(homeworkId).delete();
        showNotificationModal('Success', 'Homework deleted successfully!');
    } catch (error) {
        console.error('Error deleting homework:', error);
        showNotificationModal('Error', `Failed to delete homework: ${error.message}`);
    }
};

// Update marks form state
window.updateMarksFormState = () => {
    const classSelect = document.getElementById('marks-class');
    const subjectSelect = document.getElementById('marks-subject');
    const examSelect = document.getElementById('marks-exam-type');
    const container = document.getElementById('student-marks-container');
    const maxMarksDisplay = document.getElementById('max-marks-display');
    const studentMarksList = document.getElementById('student-marks-list');
    
    console.log('updateMarksFormState called');
    console.log('Elements found:', {
        classSelect: !!classSelect,
        subjectSelect: !!subjectSelect,
        examSelect: !!examSelect,
        container: !!container,
        studentMarksList: !!studentMarksList
    });
    
    if (!classSelect || !subjectSelect || !examSelect) {
        console.log('Missing required elements');
        return;
    }
    
    const selectedClass = classSelect.value;
    console.log('Selected class:', selectedClass);
    
    // Update subject options when class changes
    if (selectedClass) {
        console.log('Updating subject options for class:', selectedClass);
        const currentSubjectValue = subjectSelect.value; // Preserve current selection if valid
        subjectSelect.innerHTML = '<option value="" disabled selected>Select Subject</option>';
        
        const teacherAllotments = allotments.filter(a => 
            a.teacherId === currentUserData.uid && a.class === selectedClass
        );
        
        console.log('Teacher allotments for class:', teacherAllotments);
        
        if (teacherAllotments.length === 0) {
            subjectSelect.innerHTML = '<option value="" disabled>No subjects assigned for this class</option>';
        } else {
            teacherAllotments.forEach(allotment => {
                const option = document.createElement('option');
                option.value = allotment.subject;
                option.textContent = allotment.subject;
                if (allotment.subject === currentSubjectValue) {
                    option.selected = true;
                }
                subjectSelect.appendChild(option);
            });
        }
    }
    
    // Check if all fields are selected
    const allFieldsSelected = selectedClass && subjectSelect.value && examSelect.value;
    console.log('Field selection check:', {
        selectedClass: selectedClass,
        subjectValue: subjectSelect.value,
        examValue: examSelect.value,
        allSelected: allFieldsSelected
    });
    
    if (allFieldsSelected) {
        console.log('All fields selected, showing student list');
        const maxMarks = maxMarksConfig[selectedClass]?.[examSelect.value] || 100;
        maxMarksDisplay.textContent = `Max Marks: ${maxMarks}`;
        
        // Get students for this class
        console.log('Looking for students in class:', selectedClass);
        console.log('All students:', students.map(s => ({ name: s.name, class: s.class, uid: s.uid })));
        
        const classStudents = students.filter(s => {
            console.log('Checking student:', s.name, 'class:', s.class, 'matches:', s.class === selectedClass);
            return s.class === selectedClass;
        }).sort((a, b) => a.name.localeCompare(b.name));
        
        console.log('Filtered students for class', selectedClass, ':', classStudents);
        console.log('Total students in system:', students.length);
        
        if (classStudents.length === 0) {
            studentMarksList.innerHTML = `
                <div class="text-center py-8 text-gray-500">
                    <p>No students found for class ${selectedClass}</p>
                    <p class="text-sm mt-2">Make sure students are added to this class in the Admin panel</p>
                    <button onclick="debugMarksForm()" class="mt-2 bg-blue-500 text-white px-3 py-1 rounded text-sm">Debug Info</button>
                </div>
            `;
        } else {
            studentMarksList.innerHTML = classStudents.map(student => {
                const existingMark = marks.find(m => 
                    m.studentId === student.uid && 
                    m.class === selectedClass && 
                    m.subject === subjectSelect.value && 
                    m.examType === examSelect.value
                );
                
                return `
                    <div class="flex items-center justify-between p-3 bg-white border border-gray-200 rounded-lg">
                        <div class="flex-1">
                            <span class="font-medium text-gray-800">${student.name}</span>
                            <span class="text-sm text-gray-500 ml-2">(${student.username})</span>
                            ${existingMark ? `
                                <div class="text-xs text-green-600 mt-1">
                                    Current: ${existingMark.marks}/${existingMark.maxMarks} (${existingMark.percentage}% - ${existingMark.grade})
                                </div>
                            ` : ''}
                        </div>
                        <div class="flex items-center space-x-2">
                            <input 
                                type="number" 
                                name="mark-${student.uid}"
                                value="${existingMark ? existingMark.marks : ''}"
                                min="0" 
                                max="${maxMarks}" 
                                class="w-20 p-2 border border-gray-300 rounded text-center focus:border-primary focus:ring focus:ring-primary focus:ring-opacity-50"
                                placeholder="0"
                            >
                            <span class="text-sm text-gray-500">/ ${maxMarks}</span>
                            ${existingMark ? `
                                <button type="button" onclick="deleteStudentMark('${existingMark.id}', '${student.name}')" class="text-red-600 hover:text-red-800 ml-2" title="Delete Mark">
                                    <i data-lucide="trash-2" class="w-4 h-4"></i>
                                </button>
                            ` : ''}
                        </div>
                    </div>
                `;
            }).join('');
        }
        
        container.classList.remove('hidden');
        console.log('Student container shown');
        
        // Refresh icons after adding content
        refreshIcons();
    } else {
        console.log('Not all fields selected, hiding container');
        console.log('Missing fields:', {
            class: !selectedClass ? 'Class not selected' : 'OK',
            subject: !subjectSelect.value ? 'Subject not selected' : 'OK', 
            exam: !examSelect.value ? 'Exam not selected' : 'OK'
        });
        container.classList.add('hidden');
    }
};

// Handle marks submission
window.handleAddMarks = async (form) => {
    const classId = document.getElementById('marks-class').value;
    const subject = document.getElementById('marks-subject').value;
    const examType = document.getElementById('marks-exam-type').value;
    
    if (!classId || !subject || !examType) {
        showNotificationModal('Error', 'Please select class, subject, and exam type.');
        return;
    }
    
    const maxMarks = maxMarksConfig[classId]?.[examType] || 100;
    const classStudents = students.filter(s => s.class === classId);
    const markEntries = [];
    
    // Collect all mark entries
    classStudents.forEach(student => {
        const markInput = form.querySelector(`input[name="mark-${student.uid}"]`);
        if (markInput && markInput.value !== '') {
            const markValue = parseInt(markInput.value);
            if (markValue >= 0 && markValue <= maxMarks) {
                markEntries.push({
                    studentId: student.uid,
                    studentName: student.name,
                    teacherId: currentUserData.uid,
                    teacherName: currentUserData.name,
                    class: classId,
                    subject: subject,
                    examType: examType,
                    marks: markValue,
                    maxMarks: maxMarks,
                    percentage: Math.round((markValue / maxMarks) * 100),
                    grade: calculateGrade((markValue / maxMarks) * 100),
                    entryDate: new Date().toISOString().split('T')[0],
                    createdAt: new Date().toISOString()
                });
            }
        }
    });
    
    if (markEntries.length === 0) {
        showNotificationModal('Error', 'Please enter at least one valid mark.');
        return;
    }
    
    try {
        // Save or update marks
        for (const markEntry of markEntries) {
            const existingMarkQuery = await db.collection(MARKS_COLLECTION_PATH)
                .where('studentId', '==', markEntry.studentId)
                .where('class', '==', classId)
                .where('subject', '==', subject)
                .where('examType', '==', examType)
                .get();
            
            if (!existingMarkQuery.empty) {
                // Update existing mark
                const docId = existingMarkQuery.docs[0].id;
                await db.collection(MARKS_COLLECTION_PATH).doc(docId).update(markEntry);
            } else {
                // Add new mark
                await db.collection(MARKS_COLLECTION_PATH).add(markEntry);
            }
        }
        
        showNotificationModal('Success', `Marks saved successfully for ${markEntries.length} students!`);
        
        // Refresh student panel badges if needed
        refreshStudentPanelBadges();
        
        // Refresh the marks form to show updated data
        setTimeout(() => {
            updateMarksFormState();
        }, 1000);
        
    } catch (error) {
        console.error('Error saving marks:', error);
        showNotificationModal('Error', `Failed to save marks: ${error.message}`);
    }
};

// Delete individual student mark
window.deleteStudentMark = async (markId, studentName) => {
    if (!confirm(`Are you sure you want to delete the mark for ${studentName}? This action cannot be undone.`)) {
        return;
    }
    
    try {
        await db.collection(MARKS_COLLECTION_PATH).doc(markId).delete();
        showNotificationModal('Success', `Mark for ${studentName} deleted successfully!`);
        
        // Refresh the marks form to show updated data
        setTimeout(() => {
            updateMarksFormState();
        }, 500);
        
    } catch (error) {
        console.error('Error deleting mark:', error);
        showNotificationModal('Error', `Failed to delete mark: ${error.message}`);
    }
};

// Debug function for marks form
window.debugMarksForm = () => {
    console.log('=== MARKS FORM DEBUG ===');
    console.log('Current user:', currentUserData);
    console.log('User role:', currentUserData?.role);
    console.log('User UID:', currentUserData?.uid);
    console.log('Total allotments:', allotments.length);
    console.log('Teacher allotments:', allotments.filter(a => a.teacherId === currentUserData?.uid));
    console.log('Total students:', students.length);
    console.log('Students by class:', students.reduce((acc, s) => {
        acc[s.class] = (acc[s.class] || 0) + 1;
        return acc;
    }, {}));
    console.log('Teacher classes:', getTeacherClasses());
    console.log('Teacher classes for marks:', getTeacherClassesForMarks());
    
    // Check form elements
    const classSelect = document.getElementById('marks-class');
    const subjectSelect = document.getElementById('marks-subject');
    const examSelect = document.getElementById('marks-exam-type');
    console.log('Form elements:', {
        classSelect: !!classSelect,
        subjectSelect: !!subjectSelect,
        examSelect: !!examSelect,
        classValue: classSelect?.value,
        subjectValue: subjectSelect?.value,
        examValue: examSelect?.value
    });
    
    // Check if elements have options
    if (classSelect) {
        console.log('Class options:', Array.from(classSelect.options).map(o => o.value));
    }
    if (subjectSelect) {
        console.log('Subject options:', Array.from(subjectSelect.options).map(o => o.value));
    }
    if (examSelect) {
        console.log('Exam options:', Array.from(examSelect.options).map(o => o.value));
    }
    
    console.log('=== END MARKS DEBUG ===');
    
    // Force update
    updateMarksFormState();
};

// Test function to manually set form values
window.testMarksForm = () => {
    const classSelect = document.getElementById('marks-class');
    const subjectSelect = document.getElementById('marks-subject');
    const examSelect = document.getElementById('marks-exam-type');
    
    // Try to set first available values
    if (classSelect && classSelect.options.length > 1) {
        classSelect.selectedIndex = 1; // Select first non-placeholder option
        console.log('Set class to:', classSelect.value);
        updateMarksFormState(); // Trigger subject update
        
        setTimeout(() => {
            if (subjectSelect && subjectSelect.options.length > 1) {
                subjectSelect.selectedIndex = 1;
                console.log('Set subject to:', subjectSelect.value);
                
                if (examSelect && examSelect.options.length > 1) {
                    examSelect.selectedIndex = 1;
                    console.log('Set exam to:', examSelect.value);
                    updateMarksFormState(); // Final update
                }
            }
        }, 100);
    }
};

// Debug function for homework form
window.debugHomeworkForm = () => {
    console.log('=== HOMEWORK FORM DEBUG ===');
    console.log('Current user:', currentUserData);
    console.log('User role:', currentUserData?.role);
    console.log('User UID:', currentUserData?.uid);
    console.log('Total allotments:', allotments.length);
    console.log('Teacher allotments:', allotments.filter(a => a.teacherId === currentUserData?.uid));
    console.log('Teacher classes:', getTeacherClasses());
    
    // Check form elements
    const classSelect = document.getElementById('homework-class');
    const subjectSelect = document.getElementById('homework-subject');
    console.log('Homework form elements:', {
        classSelect: !!classSelect,
        subjectSelect: !!subjectSelect,
        classValue: classSelect?.value,
        subjectValue: subjectSelect?.value
    });
    
    // Check if elements have options
    if (classSelect) {
        console.log('Homework class options:', Array.from(classSelect.options).map(o => o.value));
    }
    if (subjectSelect) {
        console.log('Homework subject options:', Array.from(subjectSelect.options).map(o => o.value));
    }
    
    console.log('=== END HOMEWORK DEBUG ===');
    
    // Force update subject options
    updateSubjectOptions();
};

// Remove attachment from homework (for teacher edit)
window.removeAttachment = async (homeworkId) => {
    if (!confirm('Are you sure you want to remove this attachment?')) {
        return;
    }
    
    try {
        // Update homework to remove attachment
        const updateData = {
            attachmentUrl: null,
            attachmentName: null,
            attachmentType: null,
            updatedAt: new Date().toISOString()
        };
        
        await db.collection(HOMEWORK_COLLECTION_PATH).doc(homeworkId).update(updateData);
        showNotificationModal('Success', 'Attachment removed successfully!');
        
        // Close and reopen the edit modal to refresh content
        closeEditHomeworkModal();
        setTimeout(() => {
            editHomework(homeworkId);
        }, 500);
        
    } catch (error) {
        console.error('Error removing attachment:', error);
        showNotificationModal('Error', `Failed to remove attachment: ${error.message}`);
    }
};

// Attachment handling functions for students
window.viewAttachment = (homeworkId) => {
    const homework = homeworks.find(h => h.id === homeworkId);
    if (!homework || !homework.attachmentUrl) {
        showNotificationModal('Error', 'Attachment not found.');
        return;
    }
    
    try {
        // Open attachment in new window/tab
        const newWindow = window.open(homework.attachmentUrl, '_blank');
        if (!newWindow) {
            // If popup blocked, show notification
            showNotificationModal('Info', 'Please allow popups to view the attachment, or use the download button.');
        }
    } catch (error) {
        console.error('Error viewing attachment:', error);
        showNotificationModal('Error', 'Unable to view attachment. Please try downloading instead.');
    }
};

window.downloadAttachment = (homeworkId, fileName) => {
    const homework = homeworks.find(h => h.id === homeworkId);
    if (!homework || !homework.attachmentUrl) {
        showNotificationModal('Error', 'Attachment not found.');
        return;
    }
    
    try {
        // Create a temporary download link
        const link = document.createElement('a');
        link.href = homework.attachmentUrl;
        
        // Set the download attribute with filename
        const cleanFileName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
        const fileExtension = homework.attachmentName ? 
            homework.attachmentName.split('.').pop() : 
            (homework.attachmentType ? homework.attachmentType.split('/').pop() : 'file');
        
        link.download = `${cleanFileName}.${fileExtension}`;
        
        // Append to body, click, and remove
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        showNotificationModal('Success', 'Download started successfully!');
    } catch (error) {
        console.error('Error downloading attachment:', error);
        showNotificationModal('Error', 'Unable to download attachment. Please try again.');
    }
};

// --- STUDENT PANEL FUNCTIONS ---
const renderStudentPanel = () => {
    const panel = document.getElementById('content-panel');
    
    if (!currentUserData) {
        console.error('No current user data available for student panel');
        return;
    }
    
    const unreadNotificationCount = getUnreadNotificationCount('students');
    const newHomeworkCount = getNewHomeworkCount();
    const newMarksCount = getNewMarksCount();
    
    panel.innerHTML = `
        <p class="text-gray-600 mb-4">Welcome, ${currentUserData.name} (Class: ${currentUserData.class})</p>
        
        <!-- Student Panel Tabs Only -->
        <div class="student-tabs-container">
            <div class="grid grid-cols-1 md:grid-cols-3 gap-3 max-w-4xl mx-auto">
                <button data-tab-name="student-homework" onclick="openStudentSection('student-homework')" class="student-tab-card bg-blue-500 hover:bg-blue-600 text-white p-4 rounded-lg shadow-lg transition-all duration-300 transform hover:scale-105 relative">
                    ${newHomeworkCount > 0 ? `<div class="absolute -top-2 -right-2 bg-red-500 text-white text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center">${newHomeworkCount}</div>` : ''}
                    <div class="flex flex-col items-center">
                        <i data-lucide="book" class="w-8 h-8 mb-2"></i>
                        <h3 class="text-lg font-semibold mb-1">My Homework</h3>
                        <p class="text-blue-100 text-sm">${newHomeworkCount > 0 ? `${newHomeworkCount} new assignments` : 'View assignments'}</p>
                    </div>
                </button>
                
                <button data-tab-name="marksheet" onclick="openStudentSection('marksheet')" class="student-tab-card bg-green-500 hover:bg-green-600 text-white p-4 rounded-lg shadow-lg transition-all duration-300 transform hover:scale-105 relative">
                    ${newMarksCount > 0 ? `<div class="absolute -top-2 -right-2 bg-red-500 text-white text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center">${newMarksCount}</div>` : ''}
                    <div class="flex flex-col items-center">
                        <i data-lucide="file-text" class="w-8 h-8 mb-2"></i>
                        <h3 class="text-lg font-semibold mb-1">My Marksheet</h3>
                        <p class="text-green-100 text-sm">${newMarksCount > 0 ? `${newMarksCount} new marks` : 'View academic performance'}</p>
                    </div>
                </button>
                
                <button data-tab-name="student-notifications" onclick="openStudentSection('student-notifications')" class="student-tab-card bg-purple-500 hover:bg-purple-600 text-white p-4 rounded-lg shadow-lg transition-all duration-300 transform hover:scale-105 relative">
                    ${unreadNotificationCount > 0 ? `<div class="absolute -top-2 -right-2 bg-red-500 text-white text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center">${unreadNotificationCount}</div>` : ''}
                    <div class="flex flex-col items-center">
                        <i data-lucide="bell" class="w-8 h-8 mb-2"></i>
                        <h3 class="text-lg font-semibold mb-1">Notifications</h3>
                        <p class="text-purple-100 text-sm">${unreadNotificationCount > 0 ? `${unreadNotificationCount} unread` : 'View notifications'}</p>
                    </div>
                </button>
            </div>
        </div>

        <!-- Student Homework Section -->
        <div id="student-homework-section" class="bg-white p-4 rounded-xl shadow-lg border border-gray-100 hidden">
            <div class="homework-header-mobile flex justify-between items-center mb-4 border-b pb-2">
                <h3 class="homework-title-mobile text-xl font-semibold text-gray-800 flex items-center mb-4 md:mb-0">
                    <i data-lucide="book" class="w-5 h-5 mr-2"></i>
                    My Homework Assignments
                </h3>
                <div class="date-filter-container">
                    <div class="date-filter-group">
                        <label for="student-homework-date-from" class="text-sm font-medium text-gray-700">From:</label>
                        <input type="date" id="student-homework-date-from" class="date-filter-input px-3 py-2 border border-gray-300 rounded-lg text-sm focus:border-primary focus:ring focus:ring-primary focus:ring-opacity-50" onchange="filterStudentHomework()">
                    </div>
                    <div class="date-filter-group">
                        <label for="student-homework-date-to" class="text-sm font-medium text-gray-700">To:</label>
                        <input type="date" id="student-homework-date-to" class="date-filter-input px-3 py-2 border border-gray-300 rounded-lg text-sm focus:border-primary focus:ring focus:ring-primary focus:ring-opacity-50" onchange="filterStudentHomework()">
                    </div>
                    <div class="date-filter-presets">
                        <button type="button" onclick="setStudentHomeworkDateRange('today')" class="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs hover:bg-blue-200 transition duration-150">Today</button>
                        <button type="button" onclick="setStudentHomeworkDateRange('week')" class="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs hover:bg-blue-200 transition duration-150">This Week</button>
                        <button type="button" onclick="setStudentHomeworkDateRange('month')" class="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs hover:bg-blue-200 transition duration-150">This Month</button>
                    </div>
                    <div class="date-filter-actions">
                        <button type="button" onclick="clearStudentHomeworkFilter()" class="px-3 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm hover:bg-gray-200 transition duration-150">
                            <i data-lucide="x" class="w-4 h-4 inline mr-1"></i>
                            Clear
                        </button>
                    </div>
                </div>
            </div>
            
            <div id="student-homework-list" class="space-y-4">
                ${renderStudentHomeworkList()}
            </div>
        </div>

        <!-- Marksheet Section -->
        <div id="marksheet-section" class="bg-white p-6 rounded-xl shadow-lg border border-gray-100 hidden">
            <h3 class="text-xl font-semibold text-gray-800 mb-6 border-b pb-3 flex items-center">
                <i data-lucide="file-text" class="w-5 h-5 mr-2"></i>
                My Academic Performance
            </h3>
            
            <!-- Subject-wise Performance -->
            <div class="mb-8">
                <h4 class="text-lg font-semibold text-gray-800 mb-4">My Academic Performance</h4>
                <div id="student-marksheet">
                    ${renderStudentMarksheet()}
                </div>
            </div>
            
            <!-- Overall Performance Summary -->
            <div class="bg-gradient-to-r from-blue-50 to-indigo-50 p-6 rounded-lg border border-blue-200">
                <h4 class="text-lg font-semibold text-gray-800 mb-4">Overall Performance Summary</h4>
                <div id="performance-summary">
                    ${renderPerformanceSummary()}
                </div>
            </div>
        </div>

        <!-- Notifications Section -->
        <div id="student-notifications-section" class="bg-white p-6 rounded-xl shadow-lg border border-gray-100 hidden">
            <h3 class="text-xl font-semibold text-gray-800 mb-6 border-b pb-3 flex items-center">
                <i data-lucide="bell" class="w-5 h-5 mr-2"></i>
                My Notifications
            </h3>
            
            <div id="student-notifications-list" class="space-y-4">
                ${renderUserNotificationsList('students')}
            </div>
        </div>
    `;
    
    console.log('Student panel rendered successfully');
    
    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }
};

// Function to refresh student panel badges
const refreshStudentPanelBadges = () => {
    if (currentUserData && currentUserData.role === 'student') {
        const tabsContainer = document.querySelector('.student-tabs-container');
        if (tabsContainer && !tabsContainer.classList.contains('hidden')) {
            // Only refresh if tabs are visible (not in a section)
            console.log('Refreshing student panel badges...');
            renderStudentPanel();
        }
    }
};

// Function to refresh teacher panel badges
const refreshTeacherPanelBadges = () => {
    if (currentUserData && currentUserData.role === 'teacher') {
        const tabsContainer = document.querySelector('.teacher-tabs-container');
        if (tabsContainer && !tabsContainer.classList.contains('hidden')) {
            // Only refresh if tabs are visible (not in a section)
            console.log('Refreshing teacher panel badges...');
            renderTeacherPanel();
        }
    }
};

// New function to open student sections
window.openStudentSection = (section) => {
    console.log('Opening student section:', section);
    
    // Hide the tabs container
    const tabsContainer = document.querySelector('.student-tabs-container');
    if (tabsContainer) {
        tabsContainer.classList.add('hidden');
        console.log('Student tabs container hidden');
    } else {
        console.error('Student tabs container not found');
    }
    
    // Show back button
    const backButton = `
        <div class="mb-6">
            <button onclick="showStudentTabs()" class="btn-secondary flex items-center mb-4">
                <i data-lucide="arrow-left" class="w-4 h-4 mr-2"></i>
                Back to Student Panel
            </button>
        </div>
    `;
    
    // Hide all sections
    document.getElementById('student-homework-section')?.classList.add('hidden');
    document.getElementById('student-notifications-section')?.classList.add('hidden');
    document.getElementById('marksheet-section')?.classList.add('hidden');
    
    // Show the selected section
    const targetSection = document.getElementById(`${section}-section`);
    console.log('Looking for student section:', `${section}-section`);
    if (targetSection) {
        targetSection.classList.remove('hidden');
        console.log('Student section shown:', section);
        
        // Mark section as viewed to reset badge count
        if (section === 'student-homework') {
            markHomeworkAsViewed();
        } else if (section === 'marksheet') {
            markMarksAsViewed();
        } else if (section === 'student-notifications') {
            markNotificationsAsViewed();
        }
        
        // Add back button to the section
        if (!targetSection.querySelector('.back-button-container')) {
            targetSection.insertAdjacentHTML('afterbegin', `<div class="back-button-container">${backButton}</div>`);
        }
    } else {
        console.error('Student section not found:', `${section}-section`);
    }
    
    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }
};

// Function to show student tabs again
window.showStudentTabs = () => {
    // Hide all sections
    document.getElementById('student-homework-section')?.classList.add('hidden');
    document.getElementById('student-notifications-section')?.classList.add('hidden');
    document.getElementById('marksheet-section')?.classList.add('hidden');
    
    // Refresh the entire student panel to update badge counts
    if (currentUserData && currentUserData.role === 'student') {
        renderStudentPanel();
    }
};

// Legacy student tab switching function (kept for compatibility)
window.switchStudentTab = (tab) => {
    openStudentSection(tab);
};

// Render student's homework list
const renderStudentHomeworkList = () => {
    const studentHomeworks = homeworks.filter(h => h.class === currentUserData.class);
    
    if (studentHomeworks.length === 0) {
        return '<p class="text-gray-500 text-center py-8">No homework assigned yet.</p>';
    }
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    return studentHomeworks.sort((a, b) => new Date(b.assignedDate) - new Date(a.assignedDate))
        .map(homework => {
            const dueDate = new Date(homework.dueDate);
            const isOverdue = dueDate < today;
            const isDueToday = dueDate.toDateString() === today.toDateString();
            
            let statusClass = 'text-green-600';
            let statusText = 'Upcoming';
            
            if (isOverdue) {
                statusClass = 'text-red-600';
                statusText = 'Overdue';
            } else if (isDueToday) {
                statusClass = 'text-orange-600';
                statusText = 'Due Today';
            }
            
            return `
                <div class="bg-white p-5 rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-shadow ${isOverdue ? 'border-red-200 bg-red-50' : isDueToday ? 'border-orange-200 bg-orange-50' : ''}">
                    <!-- Subject Header -->
                    <div class="flex justify-between items-center mb-3">
                        <div class="flex items-center">
                            <span class="inline-flex items-center px-3 py-1 text-sm font-semibold bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-full shadow-sm">
                                <i data-lucide="book-open" class="w-3 h-3 mr-1"></i>
                                ${homework.subject}
                            </span>
                        </div>
                        <div class="flex flex-col items-end">
                            <span class="text-xs font-medium ${statusClass} mb-1">${statusText}</span>
                            <span class="text-xs text-gray-500">by ${homework.teacherName}</span>
                        </div>
                    </div>
                    
                    <!-- Homework Title -->
                    <div class="mb-3">
                        <h5 class="font-semibold text-gray-800 text-lg">${homework.title}</h5>
                    </div>
                    
                    <div class="mb-4">
                        <p class="text-gray-700 text-sm leading-relaxed">${homework.description}</p>
                    </div>
                    
                    ${homework.attachmentUrl ? `
                        <div class="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                            <div class="flex items-center justify-between">
                                <div class="flex items-center">
                                    <i data-lucide="paperclip" class="w-4 h-4 text-blue-600 mr-2"></i>
                                    <span class="text-sm font-medium text-blue-800 mr-2">Attachment:</span>
                                    <span class="text-sm text-gray-700">${homework.attachmentName || 'Homework File'}</span>
                                </div>
                                <div class="flex items-center space-x-2">
                                    <button onclick="viewAttachment('${homework.id}')" class="inline-flex items-center px-3 py-1 text-xs font-medium text-blue-600 bg-blue-100 hover:bg-blue-200 rounded-full transition-colors">
                                        <i data-lucide="eye" class="w-3 h-3 mr-1"></i>
                                        View
                                    </button>
                                    <button onclick="downloadAttachment('${homework.id}', '${homework.attachmentName || 'homework-file'}')" class="inline-flex items-center px-3 py-1 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-full transition-colors">
                                        <i data-lucide="download" class="w-3 h-3 mr-1"></i>
                                        Download
                                    </button>
                                </div>
                            </div>
                        </div>
                    ` : ''}
                    
                    <div class="flex flex-wrap justify-between items-center text-xs text-gray-500 pt-3 border-t border-gray-200">
                        <div class="flex items-center space-x-4">
                            <span class="flex items-center">
                                <i data-lucide="calendar-plus" class="w-3 h-3 mr-1"></i>
                                Assigned: ${new Date(homework.assignedDate).toLocaleDateString()}
                            </span>
                            <span class="flex items-center font-medium ${statusClass}">
                                <i data-lucide="calendar-clock" class="w-3 h-3 mr-1"></i>
                                Due: ${new Date(homework.dueDate).toLocaleDateString()}
                            </span>
                        </div>
                        <div class="flex items-center mt-2 sm:mt-0">
                            ${isOverdue ? `
                                <span class="inline-flex items-center px-2 py-1 text-xs font-semibold bg-red-100 text-red-800 rounded-full">
                                    <i data-lucide="alert-circle" class="w-3 h-3 mr-1"></i>
                                    Overdue
                                </span>
                            ` : isDueToday ? `
                                <span class="inline-flex items-center px-2 py-1 text-xs font-semibold bg-orange-100 text-orange-800 rounded-full">
                                    <i data-lucide="clock" class="w-3 h-3 mr-1"></i>
                                    Due Today
                                </span>
                            ` : `
                                <span class="inline-flex items-center px-2 py-1 text-xs font-semibold bg-green-100 text-green-800 rounded-full">
                                    <i data-lucide="check-circle" class="w-3 h-3 mr-1"></i>
                                    On Time
                                </span>
                            `}
                        </div>
                    </div>
                </div>
            `;
        }).join('');
};

// Render student's marksheet
const renderStudentMarksheet = () => {
    // Check if student is in a class below 3rd grade
    const studentClass = currentUserData.class;
    const classNumber = parseInt(studentClass?.match(/\d+/)?.[0]);
    
    // For classes below 3rd grade (LKG, UKG, 1st, 2nd)
    if (!classNumber || classNumber < 3 || ['LKG', 'UKG'].includes(studentClass)) {
        return `
            <div class="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-8 text-center">
                <div class="mb-4">
                    <i data-lucide="info" class="w-16 h-16 text-blue-500 mx-auto mb-4"></i>
                </div>
                <h3 class="text-xl font-semibold text-gray-800 mb-3">Academic Results Information</h3>
                <p class="text-gray-600 mb-4">
                    Formal academic results and marksheets are available for students in <strong>3rd grade and above</strong>.
                </p>
                <p class="text-sm text-gray-500 mb-6">
                    Your current class: <span class="font-semibold text-blue-600">${studentClass}</span>
                </p>
                <div class="bg-white rounded-lg p-4 border border-blue-100">
                    <p class="text-sm text-gray-600">
                        <i data-lucide="heart" class="w-4 h-4 inline text-red-500 mr-1"></i>
                        Keep learning and growing! Your academic journey is just beginning.
                    </p>
                </div>
            </div>
        `;
    }
    
    const studentMarks = marks.filter(m => m.studentId === currentUserData.uid);
    
    if (studentMarks.length === 0) {
        return '<p class="text-gray-500 text-center py-8">No marks available yet.</p>';
    }
    
    // Group marks by subject
    const marksBySubject = studentMarks.reduce((acc, mark) => {
        if (!acc[mark.subject]) {
            acc[mark.subject] = {};
        }
        acc[mark.subject][mark.examType] = mark;
        return acc;
    }, {});
    
    const subjects = getSubjectsForClass(currentUserData.class);
    
    return `
        <div class="bg-white rounded-lg border border-gray-200 overflow-hidden shadow-sm">
            <div class="overflow-x-auto">
                <table class="w-full">
                    <thead class="bg-gray-50">
                        <tr>
                            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b border-gray-200">Subject</th>
                            ${EXAM_TYPES.map(examType => `
                                <th class="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider border-b border-gray-200">${examType}</th>
                            `).join('')}
                            <th class="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider border-b border-gray-200">Average</th>
                            <th class="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider border-b border-gray-200">Grade</th>
                        </tr>
                    </thead>
                    <tbody class="bg-white divide-y divide-gray-200">
                        ${subjects.map((subject, index) => {
                            const subjectMarks = marksBySubject[subject] || {};
                            const hasMarks = Object.keys(subjectMarks).length > 0;
                            
                            // Calculate subject average
                            const validMarks = Object.values(subjectMarks).filter(m => m.percentage !== undefined);
                            const avgPercentage = validMarks.length > 0 
                                ? Math.round(validMarks.reduce((sum, m) => sum + m.percentage, 0) / validMarks.length)
                                : 0;
                            const avgGrade = hasMarks ? calculateGrade(avgPercentage) : '-';
                            
                            return `
                                <tr class="${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'} hover:bg-blue-50 transition-colors">
                                    <td class="px-4 py-4 whitespace-nowrap">
                                        <div class="text-sm font-medium text-gray-900">${subject}</div>
                                    </td>
                                    ${EXAM_TYPES.map(examType => {
                                        const mark = subjectMarks[examType];
                                        if (!mark) {
                                            return `
                                                <td class="px-3 py-4 whitespace-nowrap text-center">
                                                    <span class="text-gray-400 text-sm">-</span>
                                                </td>
                                            `;
                                        }
                                        
                                        return `
                                            <td class="px-3 py-4 whitespace-nowrap text-center">
                                                <div class="text-sm font-semibold text-gray-900">${mark.marks}/${mark.maxMarks}</div>
                                                <div class="text-xs text-gray-500">${mark.percentage}%</div>
                                                <span class="inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getGradeColor(mark.grade)}">${mark.grade}</span>
                                            </td>
                                        `;
                                    }).join('')}
                                    <td class="px-4 py-4 whitespace-nowrap text-center">
                                        ${hasMarks ? `
                                            <div class="text-sm font-semibold text-gray-900">${avgPercentage}%</div>
                                        ` : `
                                            <span class="text-gray-400 text-sm">-</span>
                                        `}
                                    </td>
                                    <td class="px-4 py-4 whitespace-nowrap text-center">
                                        ${hasMarks ? `
                                            <span class="inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getGradeColor(avgGrade)}">${avgGrade}</span>
                                        ` : `
                                            <span class="text-gray-400 text-sm">-</span>
                                        `}
                                    </td>
                                </tr>
                            `;
                        }).join('')}
                    </tbody>
                </table>
            </div>
            
            <!-- Overall Performance Summary -->
            <div class="bg-gray-50 px-4 py-3 border-t border-gray-200">
                <div class="flex flex-wrap items-center justify-between gap-4">
                    <div class="text-sm text-gray-600">
                        <strong>Overall Performance:</strong>
                    </div>
                    <div class="flex flex-wrap items-center gap-4">
                        ${(() => {
                            if (studentMarks.length === 0) return '<span class="text-gray-400">No data available</span>';
                            
                            const totalMarks = studentMarks.reduce((sum, m) => sum + m.marks, 0);
                            const totalMaxMarks = studentMarks.reduce((sum, m) => sum + m.maxMarks, 0);
                            const overallPercentage = Math.round((totalMarks / totalMaxMarks) * 100);
                            const overallGrade = calculateGrade(overallPercentage);
                            
                            return `
                                <div class="text-sm">
                                    <span class="font-semibold">${totalMarks}/${totalMaxMarks}</span>
                                    <span class="text-gray-500 ml-1">(${overallPercentage}%)</span>
                                </div>
                                <span class="inline-flex px-3 py-1 text-sm font-semibold rounded-full ${getGradeColor(overallGrade)}">${overallGrade}</span>
                            `;
                        })()}
                    </div>
                </div>
            </div>
        </div>
    `;
};

// Render performance summary
const renderPerformanceSummary = () => {
    const studentMarks = marks.filter(m => m.studentId === currentUserData.uid);
    
    if (studentMarks.length === 0) {
        return '<p class="text-gray-500 text-center">No performance data available yet.</p>';
    }
    
    // Calculate overall statistics
    const totalMarks = studentMarks.reduce((sum, m) => sum + m.marks, 0);
    const totalMaxMarks = studentMarks.reduce((sum, m) => sum + m.maxMarks, 0);
    const overallPercentage = Math.round((totalMarks / totalMaxMarks) * 100);
    const overallGrade = calculateGrade(overallPercentage);
    
    // Grade distribution
    const gradeCount = studentMarks.reduce((acc, m) => {
        acc[m.grade] = (acc[m.grade] || 0) + 1;
        return acc;
    }, {});
    
    // Subject performance
    const subjectPerformance = {};
    studentMarks.forEach(mark => {
        if (!subjectPerformance[mark.subject]) {
            subjectPerformance[mark.subject] = [];
        }
        subjectPerformance[mark.subject].push(mark.percentage);
    });
    
    const bestSubject = Object.entries(subjectPerformance).reduce((best, [subject, percentages]) => {
        const avg = percentages.reduce((sum, p) => sum + p, 0) / percentages.length;
        return avg > best.avg ? { subject, avg } : best;
    }, { subject: '', avg: 0 });
    
    return `
        <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
            <!-- Overall Performance -->
            <div class="text-center">
                <div class="text-3xl font-bold text-primary mb-2">${overallPercentage}%</div>
                <div class="text-sm text-gray-600 mb-2">Overall Performance</div>
                <span class="px-3 py-1 text-sm font-semibold rounded-full ${getGradeColor(overallGrade)}">${overallGrade} Grade</span>
            </div>
            
            <!-- Best Subject -->
            <div class="text-center">
                <div class="text-2xl font-bold text-secondary mb-2">${bestSubject.subject}</div>
                <div class="text-sm text-gray-600 mb-2">Best Subject</div>
                <div class="text-lg font-semibold text-green-600">${Math.round(bestSubject.avg)}%</div>
            </div>
            
            <!-- Total Assessments -->
            <div class="text-center">
                <div class="text-3xl font-bold text-accent mb-2">${studentMarks.length}</div>
                <div class="text-sm text-gray-600 mb-2">Total Assessments</div>
                <div class="text-sm text-gray-500">Completed</div>
            </div>
        </div>
        
        <!-- Grade Distribution -->
        <div class="mt-6">
            <h5 class="font-semibold text-gray-800 mb-3">Grade Distribution</h5>
            <div class="flex flex-wrap gap-2">
                ${Object.entries(gradeCount).map(([grade, count]) => `
                    <span class="px-3 py-1 text-sm font-semibold rounded-full ${getGradeColor(grade)}">
                        ${grade}: ${count}
                    </span>
                `).join('')}
            </div>
        </div>
    `;
};

// Get color class for grade
const getGradeColor = (grade) => {
    const colors = {
        'A1': 'bg-green-100 text-green-800',
        'A2': 'bg-green-100 text-green-700',
        'B1': 'bg-blue-100 text-blue-800',
        'B2': 'bg-blue-100 text-blue-700',
        'C1': 'bg-yellow-100 text-yellow-800',
        'D': 'bg-orange-100 text-orange-800',
        'F': 'bg-red-100 text-red-800'
    };
    return colors[grade] || 'bg-gray-100 text-gray-800';
};

// Password Change Modal Functions
window.showPasswordChangeModal = () => {
    const modal = document.getElementById('password-change-modal');
    const form = document.getElementById('password-change-form');
    const errorDiv = document.getElementById('password-error');
    
    // Reset form and hide any previous errors
    form.reset();
    errorDiv.classList.add('hidden');
    
    // Show the modal
    modal.classList.remove('hidden');
    
    // Focus on the current password field
    setTimeout(() => {
        document.getElementById('current-password').focus();
    }, 100);
    
    // Add keyboard event listener for ESC key
    const handleKeyDown = (e) => {
        if (e.key === 'Escape') {
            hidePasswordChangeModal();
            document.removeEventListener('keydown', handleKeyDown);
        }
    };
    document.addEventListener('keydown', handleKeyDown);
    
    // Add click outside to close functionality
    const handleClickOutside = (e) => {
        if (e.target === modal) {
            hidePasswordChangeModal();
            document.removeEventListener('click', handleClickOutside);
        }
    };
    modal.addEventListener('click', handleClickOutside);
    
    // Initialize icons
    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }
};

window.hidePasswordChangeModal = () => {
    const modal = document.getElementById('password-change-modal');
    modal.classList.add('hidden');
    
    // Clean up event listeners
    const newModal = modal.cloneNode(true);
    modal.parentNode.replaceChild(newModal, modal);
};

window.handlePasswordChange = async () => {
    const currentPassword = document.getElementById('current-password').value;
    const newPassword = document.getElementById('new-password').value;
    const confirmPassword = document.getElementById('confirm-password').value;
    const errorDiv = document.getElementById('password-error');
    const errorText = errorDiv.querySelector('p');
    
    // Hide previous errors
    errorDiv.classList.add('hidden');
    
    // Validation
    if (!currentPassword || !newPassword || !confirmPassword) {
        showPasswordError('Please fill in all password fields.');
        return;
    }
    
    if (newPassword.length < 4) {
        showPasswordError('New password must be at least 4 characters long.');
        return;
    }
    
    if (newPassword !== confirmPassword) {
        showPasswordError('New password and confirmation do not match.');
        return;
    }
    
    if (currentPassword === newPassword) {
        showPasswordError('New password must be different from current password.');
        return;
    }
    
    // Verify current password
    if (!currentUserData || currentUserData.loginPassword !== currentPassword) {
        showPasswordError('Current password is incorrect.');
        return;
    }
    
    try {
        // Update password in Firestore
        const userDocRef = db.collection(USERS_LIST_COLLECTION_PATH).doc(currentUserData.uid);
        await userDocRef.update({
            loginPassword: newPassword,
            lastPasswordChange: new Date().toISOString()
        });
        
        // Update local user data
        currentUserData.loginPassword = newPassword;
        userList[currentUserData.uid].loginPassword = newPassword;
        
        // Update the user in the appropriate array (teachers or students)
        if (currentUserData.role === 'teacher') {
            const teacherIndex = teachers.findIndex(t => t.uid === currentUserData.uid);
            if (teacherIndex !== -1) {
                teachers[teacherIndex].loginPassword = newPassword;
            }
        } else if (currentUserData.role === 'student') {
            const studentIndex = students.findIndex(s => s.uid === currentUserData.uid);
            if (studentIndex !== -1) {
                students[studentIndex].loginPassword = newPassword;
            }
        }
        
        // Close modal and show success message
        hidePasswordChangeModal();
        showNotificationModal('Success', 'Password changed successfully!');
        
        console.log('Password updated successfully for user:', currentUserData.uid);
        
    } catch (error) {
        console.error('Error updating password:', error);
        showPasswordError('Failed to update password. Please try again.');
    }
};

const showPasswordError = (message) => {
    const errorDiv = document.getElementById('password-error');
    const errorText = errorDiv.querySelector('p');
    errorText.textContent = message;
    errorDiv.classList.remove('hidden');
};

// --- HOMEWORK DATE FILTERING FUNCTIONS ---

// Filter teacher homework by date range
window.filterTeacherHomework = () => {
    const fromDate = document.getElementById('teacher-homework-date-from')?.value;
    const toDate = document.getElementById('teacher-homework-date-to')?.value;
    
    let filteredHomeworks = homeworks.filter(h => h.teacherId === currentUserData.uid);
    
    if (fromDate) {
        const fromDateTime = new Date(fromDate);
        filteredHomeworks = filteredHomeworks.filter(h => new Date(h.assignedDate) >= fromDateTime);
    }
    
    if (toDate) {
        const toDateTime = new Date(toDate);
        toDateTime.setHours(23, 59, 59, 999); // Include the entire end date
        filteredHomeworks = filteredHomeworks.filter(h => new Date(h.assignedDate) <= toDateTime);
    }
    
    const homeworkList = document.getElementById('teacher-homework-list');
    if (homeworkList) {
        homeworkList.innerHTML = renderFilteredTeacherHomeworkList(filteredHomeworks);
        if (typeof lucide !== 'undefined') {
            lucide.createIcons();
        }
    }
};

// Filter student homework by date range
window.filterStudentHomework = () => {
    const fromDate = document.getElementById('student-homework-date-from')?.value;
    const toDate = document.getElementById('student-homework-date-to')?.value;
    
    let filteredHomeworks = homeworks.filter(h => h.class === currentUserData.class);
    
    if (fromDate) {
        const fromDateTime = new Date(fromDate);
        filteredHomeworks = filteredHomeworks.filter(h => new Date(h.assignedDate) >= fromDateTime);
    }
    
    if (toDate) {
        const toDateTime = new Date(toDate);
        toDateTime.setHours(23, 59, 59, 999); // Include the entire end date
        filteredHomeworks = filteredHomeworks.filter(h => new Date(h.assignedDate) <= toDateTime);
    }
    
    const homeworkList = document.getElementById('student-homework-list');
    if (homeworkList) {
        homeworkList.innerHTML = renderFilteredStudentHomeworkList(filteredHomeworks);
        if (typeof lucide !== 'undefined') {
            lucide.createIcons();
        }
    }
};

// Clear teacher homework filter
window.clearTeacherHomeworkFilter = () => {
    document.getElementById('teacher-homework-date-from').value = '';
    document.getElementById('teacher-homework-date-to').value = '';
    
    const homeworkList = document.getElementById('teacher-homework-list');
    if (homeworkList) {
        homeworkList.innerHTML = renderTeacherHomeworkList();
        if (typeof lucide !== 'undefined') {
            lucide.createIcons();
        }
    }
};

// Clear student homework filter
window.clearStudentHomeworkFilter = () => {
    document.getElementById('student-homework-date-from').value = '';
    document.getElementById('student-homework-date-to').value = '';
    
    const homeworkList = document.getElementById('student-homework-list');
    if (homeworkList) {
        homeworkList.innerHTML = renderStudentHomeworkList();
        if (typeof lucide !== 'undefined') {
            lucide.createIcons();
        }
    }
};

// Render filtered teacher homework list
const renderFilteredTeacherHomeworkList = (filteredHomeworks) => {
    if (filteredHomeworks.length === 0) {
        return '<p class="text-gray-500 text-center py-8">No homework found for the selected date range.</p>';
    }
    
    return filteredHomeworks.sort((a, b) => new Date(b.assignedDate) - new Date(a.assignedDate))
        .map(homework => `
            <div class="bg-gray-50 p-4 rounded-lg border border-gray-200">
                <div class="flex justify-between items-start mb-2">
                    <div class="flex-1">
                        <h5 class="font-semibold text-gray-800">${homework.title}</h5>
                        <p class="text-sm text-gray-600 mb-2">${homework.description}</p>
                        <div class="flex items-center space-x-4 text-xs text-gray-500">
                            <span class="bg-blue-100 text-blue-800 px-2 py-1 rounded">${homework.class}</span>
                            <span class="bg-green-100 text-green-800 px-2 py-1 rounded">${homework.subject}</span>
                        </div>
                    </div>
                    <div class="flex space-x-2 ml-4">
                        <button onclick="editHomework('${homework.id}')" class="text-blue-600 hover:text-blue-800 p-1">
                            <i data-lucide="edit" class="w-4 h-4"></i>
                        </button>
                        <button onclick="deleteHomework('${homework.id}', '${homework.title}')" class="text-red-600 hover:text-red-800 p-1">
                            <i data-lucide="trash-2" class="w-4 h-4"></i>
                        </button>
                    </div>
                </div>
                ${homework.attachmentUrl ? `
                    <div class="mb-2">
                        <a href="${homework.attachmentUrl}" target="_blank" class="text-blue-600 hover:text-blue-800 text-sm flex items-center">
                            <i data-lucide="paperclip" class="w-3 h-3 mr-1"></i>
                            View Attachment
                        </a>
                    </div>
                ` : ''}
                <div class="flex justify-between items-center text-xs text-gray-500">
                    <span>Assigned: ${new Date(homework.assignedDate).toLocaleDateString()}</span>
                    <span class="font-medium ${new Date(homework.dueDate) < new Date() ? 'text-red-600' : 'text-green-600'}">
                        Due: ${new Date(homework.dueDate).toLocaleDateString()}
                    </span>
                </div>
            </div>
        `).join('');
};

// Render filtered student homework list
const renderFilteredStudentHomeworkList = (filteredHomeworks) => {
    if (filteredHomeworks.length === 0) {
        return '<p class="text-gray-500 text-center py-8">No homework found for the selected date range.</p>';
    }
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    return filteredHomeworks.sort((a, b) => new Date(b.assignedDate) - new Date(a.assignedDate))
        .map(homework => {
            const dueDate = new Date(homework.dueDate);
            const isOverdue = dueDate < today;
            const statusClass = isOverdue ? 'text-red-600' : 'text-green-600';
            const statusText = isOverdue ? 'Overdue' : 'Pending';
            
            return `
                <div class="bg-gray-50 p-4 rounded-lg border border-gray-200 ${isOverdue ? 'border-l-4 border-l-red-500' : 'border-l-4 border-l-green-500'}">
                    <div class="flex justify-between items-start mb-2">
                        <div class="flex-1">
                            <h5 class="font-semibold text-gray-800">${homework.title}</h5>
                            <p class="text-sm text-gray-600 mb-2">${homework.description}</p>
                            <div class="flex items-center space-x-4 text-xs">
                                <span class="bg-blue-100 text-blue-800 px-2 py-1 rounded">${homework.subject}</span>
                                <span class="bg-purple-100 text-purple-800 px-2 py-1 rounded">Teacher: ${getTeacherName(homework.teacherId)}</span>
                            </div>
                        </div>
                        ${homework.attachmentUrl ? `
                            <div class="flex space-x-2 ml-4">
                                <button onclick="viewAttachment('${homework.id}')" class="text-blue-600 hover:text-blue-800 p-1" title="View Attachment">
                                    <i data-lucide="eye" class="w-4 h-4"></i>
                                </button>
                                <a href="${homework.attachmentUrl}" download class="text-green-600 hover:text-green-800 p-1" title="Download Attachment">
                                    <i data-lucide="download" class="w-4 h-4"></i>
                                </a>
                            </div>
                        ` : ''}
                    </div>
                    <div class="flex justify-between items-center text-xs">
                        <div class="flex items-center space-x-4">
                            <span class="flex items-center">
                                <i data-lucide="calendar-plus" class="w-3 h-3 mr-1"></i>
                                Assigned: ${new Date(homework.assignedDate).toLocaleDateString()}
                            </span>
                            <span class="flex items-center font-medium ${statusClass}">
                                <i data-lucide="calendar-clock" class="w-3 h-3 mr-1"></i>
                                Due: ${dueDate.toLocaleDateString()} (${statusText})
                            </span>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
};

// Bulk delete homework functionality for teachers
window.bulkDeleteHomework = () => {
    const fromDate = document.getElementById('teacher-homework-date-from')?.value;
    const toDate = document.getElementById('teacher-homework-date-to')?.value;
    
    if (!fromDate && !toDate) {
        showNotificationModal('Error', 'Please select a date range to delete homework assignments.');
        return;
    }
    
    let homeworksToDelete = homeworks.filter(h => h.teacherId === currentUserData.uid);
    
    if (fromDate) {
        const fromDateTime = new Date(fromDate);
        homeworksToDelete = homeworksToDelete.filter(h => new Date(h.assignedDate) >= fromDateTime);
    }
    
    if (toDate) {
        const toDateTime = new Date(toDate);
        toDateTime.setHours(23, 59, 59, 999);
        homeworksToDelete = homeworksToDelete.filter(h => new Date(h.assignedDate) <= toDateTime);
    }
    
    if (homeworksToDelete.length === 0) {
        showNotificationModal('Info', 'No homework assignments found in the selected date range.');
        return;
    }
    
    const dateRangeText = fromDate && toDate ? 
        `from ${new Date(fromDate).toLocaleDateString()} to ${new Date(toDate).toLocaleDateString()}` :
        fromDate ? `from ${new Date(fromDate).toLocaleDateString()} onwards` :
        `up to ${new Date(toDate).toLocaleDateString()}`;
    
    if (!confirm(`Are you sure you want to delete ${homeworksToDelete.length} homework assignment(s) ${dateRangeText}? This action cannot be undone.`)) {
        return;
    }
    
    bulkDeleteHomeworkExecute(homeworksToDelete);
};

// Execute bulk delete
const bulkDeleteHomeworkExecute = async (homeworksToDelete) => {
    try {
        const deletePromises = homeworksToDelete.map(homework => 
            db.collection(HOMEWORK_COLLECTION_PATH).doc(homework.id).delete()
        );
        
        await Promise.all(deletePromises);
        
        showNotificationModal('Success', `Successfully deleted ${homeworksToDelete.length} homework assignment(s)!`);
        
        // Clear filters and refresh the list
        clearTeacherHomeworkFilter();
        
    } catch (error) {
        console.error('Error bulk deleting homework:', error);
        showNotificationModal('Error', `Failed to delete homework assignments: ${error.message}`);
    }
};

// Helper function to get teacher name by ID
const getTeacherName = (teacherId) => {
    const teacher = teachers.find(t => t.uid === teacherId);
    return teacher ? teacher.name : 'Unknown Teacher';
};

// Preset date range functions for teachers
window.setTeacherHomeworkDateRange = (range) => {
    const today = new Date();
    const fromInput = document.getElementById('teacher-homework-date-from');
    const toInput = document.getElementById('teacher-homework-date-to');
    
    let fromDate, toDate;
    
    switch (range) {
        case 'today':
            fromDate = toDate = today;
            break;
        case 'week':
            fromDate = new Date(today);
            fromDate.setDate(today.getDate() - today.getDay()); // Start of week (Sunday)
            toDate = new Date(fromDate);
            toDate.setDate(fromDate.getDate() + 6); // End of week (Saturday)
            break;
        case 'month':
            fromDate = new Date(today.getFullYear(), today.getMonth(), 1); // Start of month
            toDate = new Date(today.getFullYear(), today.getMonth() + 1, 0); // End of month
            break;
        default:
            return;
    }
    
    fromInput.value = fromDate.toISOString().split('T')[0];
    toInput.value = toDate.toISOString().split('T')[0];
    
    filterTeacherHomework();
};

// Preset date range functions for students
window.setStudentHomeworkDateRange = (range) => {
    const today = new Date();
    const fromInput = document.getElementById('student-homework-date-from');
    const toInput = document.getElementById('student-homework-date-to');
    
    let fromDate, toDate;
    
    switch (range) {
        case 'today':
            fromDate = toDate = today;
            break;
        case 'week':
            fromDate = new Date(today);
            fromDate.setDate(today.getDate() - today.getDay()); // Start of week (Sunday)
            toDate = new Date(fromDate);
            toDate.setDate(fromDate.getDate() + 6); // End of week (Saturday)
            break;
        case 'month':
            fromDate = new Date(today.getFullYear(), today.getMonth(), 1); // Start of month
            toDate = new Date(today.getFullYear(), today.getMonth() + 1, 0); // End of month
            break;
        default:
            return;
    }
    
    fromInput.value = fromDate.toISOString().split('T')[0];
    toInput.value = toDate.toISOString().split('T')[0];
    
    filterStudentHomework();
};

// --- NOTIFICATION SYSTEM FUNCTIONS ---

// Render admin notifications list
const renderAdminNotificationsList = () => {
    if (notifications.length === 0) {
        return '<p class="text-gray-500 text-center py-8">No notifications created yet.</p>';
    }
    
    return notifications.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        .map(notification => {
            const priorityClass = notification.priority === 'urgent' ? 'bg-red-100 text-red-800' :
                                notification.priority === 'important' ? 'bg-yellow-100 text-yellow-800' :
                                'bg-blue-100 text-blue-800';
            
            return `
                <div class="bg-gray-50 p-4 rounded-lg border border-gray-200">
                    <div class="flex justify-between items-start mb-2">
                        <div class="flex-1">
                            <h5 class="font-semibold text-gray-800">${notification.title}</h5>
                            <p class="text-sm text-gray-600 mb-2 line-clamp-2">${notification.content}</p>
                            <div class="flex items-center space-x-2 text-xs">
                                <span class="${priorityClass} px-2 py-1 rounded font-medium">${notification.priority.toUpperCase()}</span>
                                <span class="bg-gray-100 text-gray-800 px-2 py-1 rounded">${notification.target}</span>
                            </div>
                        </div>
                        <div class="flex space-x-2 ml-4">
                            <button onclick="editNotification('${notification.id}')" class="text-blue-600 hover:text-blue-800 p-1">
                                <i data-lucide="edit" class="w-4 h-4"></i>
                            </button>
                            <button onclick="deleteNotification('${notification.id}', '${notification.title}')" class="text-red-600 hover:text-red-800 p-1">
                                <i data-lucide="trash-2" class="w-4 h-4"></i>
                            </button>
                        </div>
                    </div>
                    <div class="text-xs text-gray-500">
                        Created: ${new Date(notification.createdAt).toLocaleDateString()} at ${new Date(notification.createdAt).toLocaleTimeString()}
                    </div>
                </div>
            `;
        }).join('');
};

// Render scrolling notifications for teacher/student panels
const renderScrollingNotifications = (userType) => {
    const relevantNotifications = notifications.filter(n => 
        n.target === 'all' || n.target === userType
    ).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    
    if (relevantNotifications.length === 0) {
        return '<span class="notification-item normal">No new notifications</span>';
    }
    
    return relevantNotifications.map(notification => 
        `<span class="notification-item ${notification.priority}" onclick="showNotificationDetail('${notification.id}')" title="Click to read full notification">
            <strong>${notification.title}</strong> - ${notification.content.substring(0, 100)}${notification.content.length > 100 ? '...' : ''}
        </span>`
    ).join('');
};

// Handle adding new notification
window.handleAddNotification = async (form) => {
    const title = form.elements['notification-title'].value.trim();
    const target = form.elements['notification-target'].value;
    const content = form.elements['notification-content'].value.trim();
    const priority = form.elements['notification-priority'].value;
    
    if (!title || !target || !content || !priority) {
        showNotificationModal('Error', 'Please fill in all fields.');
        return;
    }
    
    const notificationData = {
        title: title,
        content: content,
        target: target,
        priority: priority,
        createdAt: new Date().toISOString(),
        createdBy: currentUserData.uid
    };
    
    try {
        await db.collection(NOTIFICATIONS_COLLECTION_PATH).add(notificationData);
        showNotificationModal('Success', 'Notification created successfully!');
        
        // Refresh panel badges for teachers and students
        refreshTeacherPanelBadges();
        refreshStudentPanelBadges();
        
        // Reset form
        form.reset();
        
    } catch (error) {
        console.error('Error creating notification:', error);
        showNotificationModal('Error', `Failed to create notification: ${error.message}`);
    }
};

// Show notification detail modal
window.showNotificationDetail = (notificationId) => {
    const notification = notifications.find(n => n.id === notificationId);
    if (!notification) {
        showNotificationModal('Error', 'Notification not found.');
        return;
    }
    
    const modal = document.getElementById('notification-detail-modal');
    const titleElement = document.getElementById('notification-modal-title');
    const priorityElement = document.getElementById('notification-modal-priority');
    const contentElement = document.getElementById('notification-modal-content');
    const dateElement = document.getElementById('notification-modal-date');
    
    titleElement.innerHTML = `<i data-lucide="bell" class="w-5 h-5 mr-2"></i>${notification.title}`;
    
    const priorityClass = notification.priority === 'urgent' ? 'bg-red-100 text-red-800' :
                        notification.priority === 'important' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-blue-100 text-blue-800';
    
    priorityElement.innerHTML = `<span class="${priorityClass} px-3 py-1 rounded-full text-sm font-medium">${notification.priority.toUpperCase()}</span>`;
    contentElement.textContent = notification.content;
    dateElement.textContent = `Created on ${new Date(notification.createdAt).toLocaleDateString()} at ${new Date(notification.createdAt).toLocaleTimeString()}`;
    
    modal.classList.remove('hidden');
    
    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }
};

// Hide notification detail modal
window.hideNotificationDetailModal = () => {
    const modal = document.getElementById('notification-detail-modal');
    modal.classList.add('hidden');
};

// Edit notification
window.editNotification = (notificationId) => {
    const notification = notifications.find(n => n.id === notificationId);
    if (!notification) {
        showNotificationModal('Error', 'Notification not found.');
        return;
    }
    
    const modalHtml = `
        <div id="edit-notification-modal" class="fixed inset-0 bg-gray-600 bg-opacity-75 z-50 flex items-center justify-center">
            <div class="bg-white p-6 rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                <div class="flex justify-between items-center mb-6">
                    <h3 class="text-xl font-bold text-primary">Edit Notification</h3>
                    <button onclick="closeEditNotificationModal()" class="text-gray-400 hover:text-gray-600">
                        <i data-lucide="x" class="w-5 h-5"></i>
                    </button>
                </div>
                <form onsubmit="event.preventDefault(); handleEditNotification('${notificationId}', this);">
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-2">Title</label>
                            <input type="text" name="title" value="${notification.title}" required class="w-full p-3 border border-gray-300 rounded-lg">
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-2">Target Audience</label>
                            <select name="target" required class="w-full p-3 border border-gray-300 rounded-lg">
                                <option value="all" ${notification.target === 'all' ? 'selected' : ''}>All Users</option>
                                <option value="teachers" ${notification.target === 'teachers' ? 'selected' : ''}>Teachers Only</option>
                                <option value="students" ${notification.target === 'students' ? 'selected' : ''}>Students Only</option>
                            </select>
                        </div>
                    </div>
                    <div class="mb-4">
                        <label class="block text-sm font-medium text-gray-700 mb-2">Content</label>
                        <textarea name="content" required rows="4" class="w-full p-3 border border-gray-300 rounded-lg">${notification.content}</textarea>
                    </div>
                    <div class="mb-6">
                        <label class="block text-sm font-medium text-gray-700 mb-2">Priority</label>
                        <select name="priority" required class="w-full p-3 border border-gray-300 rounded-lg">
                            <option value="normal" ${notification.priority === 'normal' ? 'selected' : ''}>Normal</option>
                            <option value="important" ${notification.priority === 'important' ? 'selected' : ''}>Important</option>
                            <option value="urgent" ${notification.priority === 'urgent' ? 'selected' : ''}>Urgent</option>
                        </select>
                    </div>
                    <div class="flex justify-end space-x-3">
                        <button type="button" onclick="closeEditNotificationModal()" class="bg-gray-200 text-gray-700 font-semibold py-2 px-4 rounded-lg">Cancel</button>
                        <button type="submit" class="bg-primary text-white font-semibold py-2 px-4 rounded-lg hover:bg-indigo-600">Update Notification</button>
                    </div>
                </form>
            </div>
        </div>
    `;
    
    document.getElementById('modal-container').insertAdjacentHTML('beforeend', modalHtml);
    
    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }
};

// Handle edit notification
window.handleEditNotification = async (notificationId, form) => {
    const title = form.elements['title'].value.trim();
    const target = form.elements['target'].value;
    const content = form.elements['content'].value.trim();
    const priority = form.elements['priority'].value;
    
    if (!title || !target || !content || !priority) {
        showNotificationModal('Error', 'Please fill in all fields.');
        return;
    }
    
    const updateData = {
        title: title,
        content: content,
        target: target,
        priority: priority,
        updatedAt: new Date().toISOString()
    };
    
    try {
        await db.collection(NOTIFICATIONS_COLLECTION_PATH).doc(notificationId).update(updateData);
        showNotificationModal('Success', 'Notification updated successfully!');
        closeEditNotificationModal();
    } catch (error) {
        console.error('Error updating notification:', error);
        showNotificationModal('Error', `Failed to update notification: ${error.message}`);
    }
};

// Close edit notification modal
window.closeEditNotificationModal = () => {
    const modal = document.getElementById('edit-notification-modal');
    if (modal) modal.remove();
};

// Delete notification
window.deleteNotification = async (notificationId, title) => {
    if (!confirm(`Are you sure you want to delete notification "${title}"? This action cannot be undone.`)) {
        return;
    }
    
    try {
        await db.collection(NOTIFICATIONS_COLLECTION_PATH).doc(notificationId).delete();
        showNotificationModal('Success', 'Notification deleted successfully!');
    } catch (error) {
        console.error('Error deleting notification:', error);
        showNotificationModal('Error', `Failed to delete notification: ${error.message}`);
    }
};

// Get unread notification count
const getUnreadNotificationCount = (userType) => {
    if (!currentUserData) return 0;
    
    // Check when user last viewed notifications section
    const lastViewedKey = `notifications_last_viewed_${currentUserData.uid}`;
    const lastViewed = localStorage.getItem(lastViewedKey);
    const lastViewedDate = lastViewed ? new Date(lastViewed) : new Date(0);
    
    const relevantNotifications = notifications.filter(n => 
        n.target === 'all' || n.target === userType
    );
    
    // Count notifications that are newer than last viewed
    const unreadCount = relevantNotifications.filter(notification => {
        const notificationDate = new Date(notification.createdAt);
        return notificationDate > lastViewedDate;
    }).length;
    
    return unreadCount;
};

// Get new homework count for student
const getNewHomeworkCount = () => {
    if (!currentUserData || currentUserData.role !== 'student') {
        return 0;
    }
    
    // Check when student last viewed homework section
    const lastViewedKey = `homework_last_viewed_${currentUserData.uid}`;
    const lastViewed = localStorage.getItem(lastViewedKey);
    const lastViewedDate = lastViewed ? new Date(lastViewed) : new Date(0);
    
    // Get homework for student's class that's newer than last viewed
    const newHomework = homeworks.filter(hw => {
        const homeworkDate = new Date(hw.createdAt);
        return hw.class === currentUserData.class && homeworkDate > lastViewedDate;
    });
    
    return newHomework.length;
};

// Get new marks count for student
const getNewMarksCount = () => {
    if (!currentUserData || currentUserData.role !== 'student') {
        return 0;
    }
    
    // Check when student last viewed marks section
    const lastViewedKey = `marks_last_viewed_${currentUserData.uid}`;
    const lastViewed = localStorage.getItem(lastViewedKey);
    const lastViewedDate = lastViewed ? new Date(lastViewed) : new Date(0);
    
    // Get marks for this student that's newer than last viewed
    const newMarks = marks.filter(mark => {
        const markDate = new Date(mark.createdAt || mark.updatedAt);
        return mark.studentId === currentUserData.uid && markDate > lastViewedDate;
    });
    
    return newMarks.length;
};

// Mark homework section as viewed
const markHomeworkAsViewed = () => {
    if (currentUserData && currentUserData.role === 'student') {
        const lastViewedKey = `homework_last_viewed_${currentUserData.uid}`;
        localStorage.setItem(lastViewedKey, new Date().toISOString());
        console.log('Homework section marked as viewed');
    }
};

// Mark marks section as viewed
const markMarksAsViewed = () => {
    if (currentUserData && currentUserData.role === 'student') {
        const lastViewedKey = `marks_last_viewed_${currentUserData.uid}`;
        localStorage.setItem(lastViewedKey, new Date().toISOString());
        console.log('Marks section marked as viewed');
    }
};

// Mark notifications section as viewed
const markNotificationsAsViewed = () => {
    if (currentUserData) {
        const lastViewedKey = `notifications_last_viewed_${currentUserData.uid}`;
        localStorage.setItem(lastViewedKey, new Date().toISOString());
        console.log('Notifications section marked as viewed');
    }
};

// Get unread notification count badge
const getUnreadNotificationBadge = (userType) => {
    const unreadCount = getUnreadNotificationCount(userType);
    return unreadCount > 0 ? `<span class="ml-1 bg-red-500 text-white text-xs px-2 py-1 rounded-full">${unreadCount}</span>` : '';
};

// Render user notifications list (for teacher/student tabs)
const renderUserNotificationsList = (userType) => {
    const relevantNotifications = notifications.filter(n => 
        n.target === 'all' || n.target === userType
    ).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    
    if (relevantNotifications.length === 0) {
        return '<p class="text-gray-500 text-center py-8">No notifications available.</p>';
    }
    
    return relevantNotifications.map(notification => {
        const readRecord = notificationReads.find(r => 
            r.notificationId === notification.id && r.userId === currentUserData.uid
        );
        const isRead = !!readRecord;
        
        const priorityClass = notification.priority === 'urgent' ? 'bg-red-100 text-red-800 border-red-200' :
                            notification.priority === 'important' ? 'bg-yellow-100 text-yellow-800 border-yellow-200' :
                            'bg-blue-100 text-blue-800 border-blue-200';
        
        return `
            <div class="notification-card ${isRead ? 'bg-gray-50' : 'bg-white border-l-4 border-l-primary'} p-4 rounded-lg border border-gray-200 cursor-pointer hover:shadow-md transition-shadow duration-200" onclick="readNotification('${notification.id}')">
                <div class="flex justify-between items-start mb-2">
                    <div class="flex-1">
                        <div class="flex items-center space-x-2 mb-2">
                            <h5 class="font-semibold text-gray-800 ${!isRead ? 'font-bold' : ''}">${notification.title}</h5>
                            ${!isRead ? '<span class="w-2 h-2 bg-primary rounded-full"></span>' : ''}
                        </div>
                        <p class="text-sm text-gray-600 mb-2 line-clamp-3">${notification.content}</p>
                        <div class="flex items-center space-x-2 text-xs">
                            <span class="${priorityClass} px-2 py-1 rounded font-medium">${notification.priority.toUpperCase()}</span>
                            <span class="text-gray-500">${new Date(notification.createdAt).toLocaleDateString()} at ${new Date(notification.createdAt).toLocaleTimeString()}</span>
                        </div>
                    </div>
                    <div class="ml-4">
                        <i data-lucide="chevron-right" class="w-4 h-4 text-gray-400"></i>
                    </div>
                </div>
            </div>
        `;
    }).join('');
};

// Mark notification as read
window.readNotification = async (notificationId) => {
    const notification = notifications.find(n => n.id === notificationId);
    if (!notification) {
        showNotificationModal('Error', 'Notification not found.');
        return;
    }
    
    // Check if already read
    const existingRead = notificationReads.find(r => 
        r.notificationId === notificationId && r.userId === currentUserData.uid
    );
    
    if (!existingRead) {
        // Mark as read in Firestore
        try {
            await db.collection(NOTIFICATION_READS_COLLECTION_PATH).add({
                notificationId: notificationId,
                userId: currentUserData.uid,
                readAt: new Date().toISOString()
            });
        } catch (error) {
            console.error('Error marking notification as read:', error);
        }
    }
    
    // Show notification detail
    showNotificationDetail(notificationId);
};

// --- DATA LOADING & REAL-TIME LISTENERS ---
const loadAndListen = async () => {
    if (!db) {
        document.getElementById('loading-text').textContent = "Initialization Failed: Database object not ready.";
        return;
    }

    const loadingText = document.getElementById('loading-text');

    loadingText.textContent = "Checking for existing users and initializing admin...";
    try {
        const adminDoc = await db.collection(USERS_LIST_COLLECTION_PATH).doc('ADM_12345').get();
        if (!adminDoc.exists || adminDoc.data().role !== 'admin') {
            await initializeAdminUser();
        }
    } catch (error) {
        console.error("Error during initial user check:", error);
        loadingText.textContent = `Initial Load Error: ${error.message}.`;
        document.getElementById('loading-spinner').classList.add('hidden');
        return;
    }

    loadingText.textContent = "Setting up real-time data listeners...";

    // 1. Users Listener
    const userUnsubscribe = db.collection(USERS_LIST_COLLECTION_PATH).onSnapshot((snapshot) => {
        const fetchedUsers = {};
        teachers = [];
        students = [];
        
        snapshot.forEach(doc => {
            const data = { ...doc.data(), id: doc.id };
            if (data.role) { 
                fetchedUsers[data.uid] = data;
                if (data.role === 'teacher') teachers.push(data);
                if (data.role === 'student') students.push(data);
            }
        });
        userList = fetchedUsers;
        
        console.log(`User list updated. Total users: ${Object.keys(userList).length}`);
        
        if (document.getElementById('loading-spinner') && Object.keys(userList).length > 0) {
            document.getElementById('loading-spinner').classList.add('hidden');
            document.getElementById('loading-text').classList.add('hidden');
            if (!currentUserData) {
                 showRoleSelector();
            }
        }

        // If user is already logged in, update their data and re-render the panel
        if (currentUserId && userList[currentUserId]) {
            currentUserData = userList[currentUserId];
            updateHeader(currentUserData);
            showDashboard(currentUserData);
        }
        
        // If admin panel is active, refresh the user tables
        if (currentUserData && currentUserData.role === 'admin') {
            renderUserTables(teachers, students);
        }
    }, (error) => {
        console.error("Error loading user list:", error);
        document.getElementById('loading-text').textContent = `Data Error: ${error.message}. Check Security Rules (403).`;
        document.getElementById('loading-spinner').classList.add('hidden');
    });

    // 2. Allotments, Homework, Marks Listeners (Reload panels on change)
    db.collection(ALLOTMENTS_COLLECTION_PATH).onSnapshot((snapshot) => {
        allotments = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        console.log('Allotments updated:', allotments.length);
        console.log('Current user:', currentUserData?.uid, 'Role:', currentUserData?.role);
        
        // Refresh teacher panel if active
        if (currentUserData && currentUserData.role === 'teacher') {
            console.log('Refreshing teacher panel due to allotment changes');
            renderTeacherPanel();
        }
        
        // Also refresh admin panel to show updated allotments
        if (currentUserData && currentUserData.role === 'admin') {
            renderUserTables(teachers, students);
        }
    });

    db.collection(HOMEWORK_COLLECTION_PATH).onSnapshot((snapshot) => {
        homeworks = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        console.log('Homework updated:', homeworks.length);
        
        // Refresh teacher and student panels if active
        if (currentUserData && currentUserData.role === 'teacher') {
            const homeworkList = document.getElementById('teacher-homework-list');
            if (homeworkList) {
                homeworkList.innerHTML = renderTeacherHomeworkList();
                if (typeof lucide !== 'undefined') {
                    lucide.createIcons();
                }
            }
        }
        if (currentUserData && currentUserData.role === 'student') {
            const homeworkList = document.getElementById('student-homework-list');
            if (homeworkList) {
                homeworkList.innerHTML = renderStudentHomeworkList();
                if (typeof lucide !== 'undefined') {
                    lucide.createIcons();
                }
            }
        }
    });

    db.collection(MARKS_COLLECTION_PATH).onSnapshot((snapshot) => {
        marks = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        console.log('Marks updated:', marks.length);
        
        // Refresh teacher marks form if active
        if (currentUserData && currentUserData.role === 'teacher') {
            updateMarksFormState();
        }
        // Refresh student marksheet if active
        if (currentUserData && currentUserData.role === 'student') {
            const marksheet = document.getElementById('student-marksheet');
            const summary = document.getElementById('performance-summary');
            if (marksheet) {
                marksheet.innerHTML = renderStudentMarksheet();
            }
            if (summary) {
                summary.innerHTML = renderPerformanceSummary();
            }
            if (typeof lucide !== 'undefined') {
                lucide.createIcons();
            }
        }
    });

    // Max Marks Configuration Listener
    db.collection(MAX_MARKS_COLLECTION_PATH).onSnapshot((snapshot) => {
        maxMarksConfig = {};
        snapshot.forEach(doc => {
            const data = doc.data();
            if (data.classId && data.examType) {
                // Class-specific configuration
                if (!maxMarksConfig[data.classId]) {
                    maxMarksConfig[data.classId] = {};
                }
                maxMarksConfig[data.classId][data.examType] = data.maxMarks;
            }
        });
        console.log('Max marks configuration updated:', maxMarksConfig);
    });

    // Notifications Listener
    db.collection(NOTIFICATIONS_COLLECTION_PATH).onSnapshot((snapshot) => {
        notifications = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        console.log('Notifications updated:', notifications.length);
        
        // Refresh admin notifications list if active
        if (currentUserData && currentUserData.role === 'admin') {
            const notificationsList = document.getElementById('admin-notifications-list');
            if (notificationsList) {
                notificationsList.innerHTML = renderAdminNotificationsList();
                if (typeof lucide !== 'undefined') {
                    lucide.createIcons();
                }
            }
        }
        
        // Refresh notification lists and badges for teachers and students
        if (currentUserData && currentUserData.role === 'teacher') {
            const notificationsList = document.getElementById('teacher-notifications-list');
            if (notificationsList) {
                notificationsList.innerHTML = renderUserNotificationsList('teachers');
                if (typeof lucide !== 'undefined') {
                    lucide.createIcons();
                }
            }
            // Update tab badge
            const notificationTab = document.querySelector('[data-tab-name="notifications"]');
            if (notificationTab) {
                notificationTab.innerHTML = `<i data-lucide="bell" class="w-4 h-4 mr-2"></i> Notifications ${getUnreadNotificationBadge('teachers')}`;
                if (typeof lucide !== 'undefined') {
                    lucide.createIcons();
                }
            }
        }
        
        if (currentUserData && currentUserData.role === 'student') {
            const notificationsList = document.getElementById('student-notifications-list');
            if (notificationsList) {
                notificationsList.innerHTML = renderUserNotificationsList('students');
                if (typeof lucide !== 'undefined') {
                    lucide.createIcons();
                }
            }
            // Update tab badge
            const notificationTab = document.querySelector('[data-tab-name="notifications"]');
            if (notificationTab) {
                notificationTab.innerHTML = `<i data-lucide="bell" class="w-4 h-4 mr-2"></i> Notifications ${getUnreadNotificationBadge('students')}`;
                if (typeof lucide !== 'undefined') {
                    lucide.createIcons();
                }
            }
        }
    });

    // Notification Reads Listener
    db.collection(NOTIFICATION_READS_COLLECTION_PATH).onSnapshot((snapshot) => {
        notificationReads = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        console.log('Notification reads updated:', notificationReads.length);
        
        // Refresh notification tabs and badges for teachers and students
        if (currentUserData && (currentUserData.role === 'teacher' || currentUserData.role === 'student')) {
            // Re-render the panels to update badges
            if (currentUserData.role === 'teacher') {
                const notificationsList = document.getElementById('teacher-notifications-list');
                if (notificationsList) {
                    notificationsList.innerHTML = renderUserNotificationsList('teachers');
                    if (typeof lucide !== 'undefined') {
                        lucide.createIcons();
                    }
                }
                // Update tab badge
                const notificationTab = document.querySelector('[data-tab-name="notifications"]');
                if (notificationTab) {
                    notificationTab.innerHTML = `<i data-lucide="bell" class="w-4 h-4 mr-2"></i> Notifications ${getUnreadNotificationBadge('teachers')}`;
                    if (typeof lucide !== 'undefined') {
                        lucide.createIcons();
                    }
                }
            }
            
            if (currentUserData.role === 'student') {
                const notificationsList = document.getElementById('student-notifications-list');
                if (notificationsList) {
                    notificationsList.innerHTML = renderUserNotificationsList('students');
                    if (typeof lucide !== 'undefined') {
                        lucide.createIcons();
                    }
                }
                // Update tab badge
                const notificationTab = document.querySelector('[data-tab-name="notifications"]');
                if (notificationTab) {
                    notificationTab.innerHTML = `<i data-lucide="bell" class="w-4 h-4 mr-2"></i> Notifications ${getUnreadNotificationBadge('students')}`;
                    if (typeof lucide !== 'undefined') {
                        lucide.createIcons();
                    }
                }
            }
        }
    });
};
