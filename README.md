# School Management System

A comprehensive web-based school management system for DAV Public School NTPC Township, Jamthal.

## Features

- **User Management**: Admin, Teacher, and Student roles
- **Authentication System**: Secure login with role-based access
- **Homework Management**: Teachers can assign and students can view homework
- **Marks Management**: Teachers can enter marks and students can view marksheets
- **Responsive Design**: Works on desktop and mobile devices
- **Modern UI**: Built with Tailwind CSS and Lucide icons

## Project Structure

```
School Management System/
├── index.html              # Main application file
├── assets/
│   ├── css/
│   │   └── styles.css      # Custom CSS styles
│   ├── js/
│   │   ├── app.js          # Application utilities
│   │   └── firebase-app.js # Firebase integration
│   └── images/
│       └── logo.png        # School logo
├── README.md               # This file
└── logo.png               # Legacy logo file (for compatibility)
```

## Deployment Instructions

### GitHub Pages Deployment

1. **Create a new repository** on GitHub
2. **Upload all files** to the repository
3. **Enable GitHub Pages**:
   - Go to repository Settings
   - Scroll to "Pages" section
   - Select "Deploy from a branch"
   - Choose "main" branch and "/ (root)" folder
   - Click Save

### Important Notes for Deployment

- All asset paths use relative URLs (`./assets/...`) for GitHub Pages compatibility
- The logo is properly referenced in both header and footer
- CSS is externalized for better caching and organization
- JavaScript is modularized for maintainability

### File Dependencies

- **Tailwind CSS**: Loaded from CDN for styling
- **Lucide Icons**: Loaded from CDN for icons
- **Firebase**: Used for backend data management
- **SheetJS**: For Excel import/export functionality

## Browser Compatibility

- Chrome (recommended)
- Firefox
- Safari
- Edge

## Firebase Setup

### 1. Firestore Security Rules
Copy the contents of `firestore.rules` to your Firebase Console:
1. Go to Firebase Console → Firestore Database → Rules
2. Replace the existing rules with the content from `firestore.rules`
3. Click "Publish"

### 2. Authentication Setup
1. Go to Firebase Console → Authentication → Sign-in method
2. Enable "Anonymous" authentication
3. Save changes

### 3. Configuration
The Firebase configuration is already set up in `assets/js/firebase-app.js` with your project details:
- Project ID: `school-management-system-13cda`
- All necessary Firebase services are configured

### 4. Deploy to Firebase Hosting (Optional)
```bash
npm install -g firebase-tools
firebase login
firebase init hosting
firebase deploy
```

## Default Login Credentials

- **Admin**: username: `admin`, password: `admin`
- **Teachers/Students**: Created by admin with custom credentials

## Support

For technical support or questions, contact the school IT department.

---

© 2025 DAV Public School NTPC Township, Jamthal. All Rights Reserved.
